"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock3, ShieldAlert, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shouldShowAnswersTab } from "./answers-tab";
import { CampaignsPanel } from "./campaigns-panel";
import { EventsPanel } from "./events-panel";
import { FunnelCreateDialog, type CreatedFunnel } from "./funnel-create-dialog";
import { FunnelPanel } from "./funnel-panel";
import { formatTimestamp } from "./format";
import { InstallerPanel } from "./installer-panel";
import { JourneysPanel } from "./journeys-panel";
import type { PeriodKey } from "./period";
import { PeriodFilter } from "./period-filter";
import { ProvisionedFunnelPanel } from "./provisioned-funnel-panel";
import { ResponsesPanel } from "./responses-panel";
import { SummaryCards } from "./summary-cards";
import type { QuizModuleAnalyticsResult } from "./types";
import type { QuizDashboardProject, QuizDashboardProjectsResult } from "@/lib/sistemas/quiz/projects-client.mjs";

function notConfiguredMessage(reason: string | undefined) {
  return reason === "MISSING_CREDENTIALS"
    ? "As credenciais server-only do Funnel Analytics não estão configuradas neste ambiente. O Banco não consegue listar ou criar funis até isso ser resolvido."
    : "O Funnel Analytics ainda não está configurado neste ambiente. Nenhum funil foi ocultado nem substituído por dados de exemplo.";
}

function errorMessage(code: string | undefined) {
  const messages: Record<string, string> = {
    UNAUTHORIZED: "O Funnel Analytics recusou a credencial configurada (401/403).",
    TIMEOUT: "O Funnel Analytics demorou mais que o limite seguro para responder.",
    UNEXPECTED_REDIRECT: "O Funnel Analytics respondeu com um redirecionamento, que este Banco não segue por segurança.",
    RESPONSE_SCHEMA_INVALID: "O Funnel Analytics respondeu com um formato que este Banco não reconhece.",
    RESPONSE_JSON_INVALID: "O Funnel Analytics respondeu com um corpo que não é JSON válido.",
    RESPONSE_TOO_LARGE: "A resposta do Funnel Analytics excedeu o tamanho máximo aceito.",
    UPSTREAM_ERROR: "O Funnel Analytics retornou um erro interno.",
    REQUEST_INVALID: "O Funnel Analytics recusou a requisição.",
    RESPONSE_FILTER_MISMATCH: "O Funnel Analytics respondeu com dados de outro funil; a leitura foi bloqueada para não misturar resultados.",
    NETWORK_ERROR: "Não foi possível alcançar o Funnel Analytics nesta leitura.",
  };
  return messages[code ?? ""] ?? "Não foi possível consultar o Funnel Analytics nesta leitura.";
}

function projectDescriptor(project: QuizDashboardProject) {
  return `${project.name} · ${project.state} · ${project.origin ?? "origem não informada"}`;
}

function ProjectSelector({ projects, selectedProject, projectNotFound }: { projects: QuizDashboardProject[]; selectedProject?: QuizDashboardProject; projectNotFound?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectProject(projectId: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("project", projectId);
    query.delete("funnel");
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="quiz-funnel-focus-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="quiz-funnel-focus-title" className="text-sm font-semibold">Funil em foco</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Selecione um funil registrado no Funnel Analytics. Nome, situação e origem vêm da lista canônica; nenhum ID precisa ser digitado.</p>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:min-w-80">
          Funil
          <select value={selectedProject?.projectId ?? ""} onChange={(event) => selectProject(event.target.value)} aria-describedby={projectNotFound ? "quiz-project-not-found" : undefined} className="min-h-11 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9 dark:bg-input/30">
            {projects.map((project) => <option key={project.projectId} value={project.projectId}>{projectDescriptor(project)}</option>)}
          </select>
        </label>
      </div>
      {projectNotFound ? <p id="quiz-project-not-found" className="mt-3 text-xs text-warning" role="status">O funil pedido na URL não está mais na lista canônica. Exibimos o primeiro funil disponível, sem consultar o identificador antigo.</p> : null}
    </section>
  );
}

function Unavailable({ result, title }: { result: Exclude<QuizDashboardProjectsResult<{ provisioningEnabled: boolean; projects: QuizDashboardProject[] }> | QuizModuleAnalyticsResult, { kind: "success" }>; title: string }) {
  const configured = result.kind === "not_configured";
  const detail = configured ? notConfiguredMessage(result.reason) : errorMessage(result.code);
  return (
    <section className={`rounded-lg border p-5 ${configured ? "bg-muted/30" : "border-danger/40 bg-danger-muted"}`} aria-live="polite">
      <div className="flex items-start gap-3">
        {configured ? <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />}
        <div><h2 className="font-semibold">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{detail}</p><p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico seguro: {configured ? result.reason ?? "NOT_CONFIGURED" : result.code ?? "UNKNOWN"}</p></div>
      </div>
    </section>
  );
}

function EmptyProjects({ provisioningEnabled, onCreated }: { provisioningEnabled: boolean; onCreated: (created: CreatedFunnel) => void }) {
  return <section className="rounded-lg border bg-card p-6" aria-labelledby="quiz-projects-empty-title"><h2 id="quiz-projects-empty-title" className="text-base font-semibold">Nenhum funil disponível</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">A lista canônica do Funnel Analytics não retornou projetos para este operador. O Banco não cria uma seleção de exemplo e não envia você ao painel externo.</p><div className="mt-4"><FunnelCreateDialog provisioningEnabled={provisioningEnabled} onCreated={onCreated} /></div></section>;
}

export function QuizAnalyticsView({ result, projectsResult, selectedProject, period, customFrom, customTo, projectNotFound }: { result: QuizModuleAnalyticsResult | null; projectsResult: QuizDashboardProjectsResult<{ provisioningEnabled: boolean; projects: QuizDashboardProject[] }>; selectedProject?: QuizDashboardProject; period: PeriodKey; customFrom?: string; customTo?: string; projectNotFound?: boolean }) {
  const [created, setCreated] = useState<CreatedFunnel | null>(null);
  if (projectsResult.kind !== "success") return <div className="space-y-6"><PageHeader title="Funnel Analytics" description="Crie, instale e acompanhe o caminho de cada funil sem sair do Banco NGV." /><Unavailable result={projectsResult} title={projectsResult.kind === "not_configured" ? "Funnel Analytics não configurado" : "Lista de funis indisponível"} /></div>;

  const { projects, provisioningEnabled } = projectsResult.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Funnel Analytics" description="Crie, instale e acompanhe o caminho de cada funil sem sair do Banco NGV." /><div className="flex min-h-11 items-center gap-2"><StatusBadge variant="success">Lista ao vivo</StatusBadge><FunnelCreateDialog provisioningEnabled={provisioningEnabled} onCreated={setCreated} /></div></div>
      {created ? <ProvisionedFunnelPanel created={created} /> : null}
      {projects.length === 0 ? <EmptyProjects provisioningEnabled={provisioningEnabled} onCreated={setCreated} /> : <>
        <ProjectSelector projects={projects} selectedProject={selectedProject} projectNotFound={projectNotFound} />
        {selectedProject && result ? <AnalyticsContent result={result} project={selectedProject} period={period} customFrom={customFrom} customTo={customTo} created={created} /> : <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Escolha um funil da lista para carregar a leitura correspondente.</section>}
      </>}
    </div>
  );
}

function AnalyticsContent({ result, project, period, customFrom, customTo, created }: { result: QuizModuleAnalyticsResult; project: QuizDashboardProject; period: PeriodKey; customFrom?: string; customTo?: string; created: CreatedFunnel | null }) {
  if (result.kind !== "success") return <Unavailable result={result} title="Não foi possível ler o funil selecionado" />;
  const { data } = result;
  const hasQuizAnswers = shouldShowAnswersTab(data.metadata);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3"><PeriodFilter current={period} customFrom={customFrom} customTo={customTo} projectId={project.projectId} /><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> Gerado em {formatTimestamp(data.generatedAt)}</span></div>
    <SummaryCards summary={data.summary} />
    <Tabs defaultValue="overview"><TabsList className="h-auto max-w-full flex-wrap" aria-label="Seções do funil"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="journeys">Jornada</TabsTrigger>{hasQuizAnswers ? <TabsTrigger value="answers">Perguntas e respostas</TabsTrigger> : null}<TabsTrigger value="events">Eventos</TabsTrigger><TabsTrigger value="installer">Instalação</TabsTrigger></TabsList>
      <TabsContent value="overview" className="mt-4"><FunnelPanel funnel={data.funnel} /></TabsContent><TabsContent value="journeys" className="mt-4"><JourneysPanel journeys={data.journeys} /></TabsContent>{hasQuizAnswers ? <TabsContent value="answers" className="mt-4"><ResponsesPanel responses={data.responses} /></TabsContent> : null}<TabsContent value="events" className="mt-4"><EventsPanel events={data.recentEvents} /></TabsContent><TabsContent value="installer" className="mt-4"><InstallerPanel installation={created?.data.installation} initialDomain={created?.data.project.finalUrl ?? project.finalUrl ?? undefined} /></TabsContent>
    </Tabs><CampaignsPanel campaigns={data.utmCampaigns} />
  </>;
}
