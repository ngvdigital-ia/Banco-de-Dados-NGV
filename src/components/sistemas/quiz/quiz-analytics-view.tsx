import { Clock3, ShieldAlert, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignsPanel } from "./campaigns-panel";
import { EventsPanel } from "./events-panel";
import { FunnelFilter } from "./funnel-filter";
import { FunnelPanel } from "./funnel-panel";
import { formatTimestamp } from "./format";
import { InstallerPanel } from "./installer-panel";
import { JourneysPanel } from "./journeys-panel";
import type { PeriodKey } from "./period";
import { PeriodFilter } from "./period-filter";
import { ResponsesPanel } from "./responses-panel";
import { SummaryCards } from "./summary-cards";
import type { QuizModuleAnalyticsResult } from "./types";

function notConfiguredMessage(reason: string | undefined) {
  switch (reason) {
    case "MISSING_CREDENTIALS":
      return "As credenciais do painel do Quiz (QUIZ_DASHBOARD_USERNAME/QUIZ_DASHBOARD_PASSWORD) não estão configuradas neste ambiente.";
    default:
      return "Este ambiente ainda não tem o módulo do Quiz configurado.";
  }
}

function errorMessage(code: string | undefined) {
  switch (code) {
    case "UNAUTHORIZED":
      return "O Quiz recusou a credencial configurada (401/403).";
    case "TIMEOUT":
      return "O Quiz demorou mais que o limite seguro para responder.";
    case "UNEXPECTED_REDIRECT":
      return "O Quiz respondeu com um redirecionamento, que este adapter nunca segue.";
    case "RESPONSE_SCHEMA_INVALID":
      return "O Quiz respondeu com um formato que este painel não reconhece.";
    case "RESPONSE_JSON_INVALID":
      return "O Quiz respondeu com um corpo que não é JSON válido.";
    case "RESPONSE_TOO_LARGE":
      return "A resposta do Quiz excedeu o tamanho máximo aceito.";
    case "UPSTREAM_ERROR":
      return "O Quiz retornou um erro interno.";
    case "REQUEST_INVALID":
      return "O Quiz recusou a requisição.";
    case "RESPONSE_FILTER_MISMATCH":
      return "O Quiz respondeu com dados de outro funil; a leitura foi bloqueada para não misturar resultados.";
    case "NETWORK_ERROR":
      return "Não foi possível alcançar o Quiz nesta leitura.";
    default:
      return "Não foi possível consultar o Quiz nesta leitura.";
  }
}

export function QuizAnalyticsView({
  result,
  period,
  customFrom,
  customTo,
  activeFunnel,
  invalidFunnelRequested,
}: {
  result: QuizModuleAnalyticsResult;
  period: PeriodKey;
  customFrom?: string;
  customTo?: string;
  activeFunnel: string;
  invalidFunnelRequested?: boolean;
}) {
  if (result.kind === "not_configured") {
    return (
      <div className="space-y-6">
        <PageHeader title="Quiz" description="Funil, respostas, eventos e jornadas do Quiz." />
        <section className="rounded-lg border border-border bg-muted/30 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Módulo não configurado</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notConfiguredMessage(result.reason)}</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico: {result.reason ?? "NOT_CONFIGURED"}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader title="Quiz" description="Funil, respostas, eventos e jornadas do Quiz." />
          <StatusBadge variant="danger">Leitura indisponível</StatusBadge>
        </div>
        <section className="rounded-lg border border-danger/40 bg-danger-muted p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Não foi possível ler os dados do Quiz agora</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{errorMessage(result.code)} Nenhum número abaixo foi inventado — a falha aparece como falha, não como zero.</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico seguro: {result.code ?? "UNKNOWN"}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Quiz" description="Tráfego por página, funil, respostas e jornadas — leitura direta do módulo Quiz." />
        <StatusBadge variant="success">Leitura ao vivo</StatusBadge>
      </div>

      <FunnelFilter
        activeFunnel={activeFunnel}
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        invalidRequested={invalidFunnelRequested}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter current={period} customFrom={customFrom} customTo={customTo} funnelId={activeFunnel} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden="true" /> Gerado em {formatTimestamp(data.generatedAt)}
        </span>
      </div>

      <SummaryCards summary={data.summary} />

      <Tabs defaultValue="journeys">
        <TabsList>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="answers">Respostas</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="journeys">Jornadas</TabsTrigger>
          <TabsTrigger value="installer">Instalar tracker</TabsTrigger>
        </TabsList>
        <TabsContent value="funnel" className="mt-4">
          <FunnelPanel funnel={data.funnel} />
        </TabsContent>
        <TabsContent value="answers" className="mt-4">
          <ResponsesPanel responses={data.responses} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsPanel events={data.recentEvents} />
        </TabsContent>
        <TabsContent value="journeys" className="mt-4">
          <JourneysPanel journeys={data.journeys} />
        </TabsContent>
        <TabsContent value="installer" className="mt-4">
          <InstallerPanel />
        </TabsContent>
      </Tabs>

      {/* Persistente, fora das abas — igual ao original (index (1).html:97-100): visível
         sob qualquer aba ativa, não só a de Funil. */}
      <CampaignsPanel campaigns={data.utmCampaigns} />
    </div>
  );
}
