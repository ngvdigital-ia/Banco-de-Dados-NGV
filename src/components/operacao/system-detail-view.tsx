import Link from "next/link";
import { ArrowLeft, CircleDashed, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SYSTEM_DIRECTORY, type SystemId } from "@/lib/operacao/system-directory";
import { cn } from "@/lib/utils";
import type { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";

type NgvCoreOperationalSummary = Awaited<ReturnType<typeof fetchNgvCoreOperationalSummary>>;

type Metric = {
  label: string;
  value: number | string | null;
  description?: string;
  observation?: string;
  action?: { href: string; label: string };
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Sem leitura";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function unavailableMessage(code: string | undefined) {
  switch (code) {
    case "WRITER_KEY_MISSING":
      return "A credencial de leitura não está disponível neste ambiente.";
    case "SUMMARY_REQUEST_INVALID":
      return "O Core recusou a leitura autenticada.";
    case "SUMMARY_TIMEOUT":
      return "O Core demorou mais que o limite seguro para responder.";
    case "RESPONSE_SCHEMA_INVALID":
      return "O Core respondeu com um contrato que este painel não reconhece.";
    default:
      return "Não foi possível consultar o Core nesta leitura.";
  }
}

function metricsFor(system: SystemId, summary: NgvCoreOperationalSummary): { metrics: Metric[]; observedAt: string | null | undefined; freshness: { is_stale: boolean; age_hours: number } | undefined; sourceLabel: string } {
  const sourceFreshness = summary.freshness?.by_source;
  switch (system) {
    case "banco-ngv": {
      const source = summary.sources.banco_ngv;
      return {
        metrics: [
          {
            label: "Ofertas cadastradas",
            value: source?.offer_tracking_count ?? null,
            description: "Registros de oferta que já existem no dashboard. A lista detalhada fica em Ofertas.",
            observation: source?.latest_offer_at ? `Última oferta registrada: ${formatTimestamp(source.latest_offer_at)}` : "Última oferta registrada: Sem leitura",
            action: { href: "/offers?month=all", label: "Ver todas as ofertas" },
          },
          {
            label: "Registros históricos de métricas",
            value: source?.metrics_snapshot_count ?? null,
            description: "Leituras datadas de métricas; não representam novas ofertas.",
            observation: source?.latest_metric_at ? `Última leitura de métrica: ${formatTimestamp(source.latest_metric_at)}` : "Última leitura de métrica: Sem leitura",
          },
        ],
        observedAt: source?.generated_at,
        freshness: sourceFreshness?.banco_ngv,
        sourceLabel: "banco-ngv no resumo do Core",
      };
    }
    case "apps-ofertas": {
      const source = summary.sources.apps_ofertas;
      return { metrics: [{ label: "Ofertas", value: source?.offers_configured ?? null }, { label: "Acessos ativos", value: source?.access_active ?? null }, { label: "Compras", value: source?.purchases_total ?? null }, { label: "Grants ativos", value: source?.product_grants_active ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.apps_ofertas, sourceLabel: "apps-ofertas no resumo do Core" };
    }
    case "cursos": {
      const source = summary.sources.plataforma_cursos;
      return { metrics: [{ label: "Cursos", value: source?.courses_total ?? null }, { label: "Acessos ativos", value: source?.entitlements_active ?? null }, { label: "Entitlements", value: source?.entitlements_total ?? null }, { label: "Última atividade", value: source?.latest_progress_at ? formatTimestamp(source.latest_progress_at) : null }], observedAt: source?.generated_at, freshness: sourceFreshness?.plataforma_cursos, sourceLabel: "plataforma-cursos no resumo do Core" };
    }
    case "spy": {
      const source = summary.sources.spy;
      return { metrics: [{ label: "Ofertas observadas", value: source?.offers_observed ?? null }, { label: "Leituras", value: source?.readings_observed ?? null }, { label: "Dias com leitura", value: source?.distinct_reading_days ?? null }, { label: "Prontas para modelar", value: source?.ready_to_model ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.spy, sourceLabel: "spy-analytics no resumo do Core" };
    }
    case "quiz": {
      const source = summary.sources.quiz_analytics;
      return { metrics: [{ label: "Funis", value: source?.project_count ?? null }, { label: "Instalados", value: source?.installed_count ?? null }, { label: "Recebendo eventos", value: source?.receiving_events_count ?? null }, { label: "Com oferta vinculada", value: source?.projects_with_offer_id_count ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.quiz_analytics, sourceLabel: "quiz-analytics no resumo do Core" };
    }
    case "nexfy": {
      const source = summary.sources.nexfy;
      return { metrics: [{ label: "Projetos ativos", value: source?.active_projects ?? null }, { label: "Produtos ativos", value: source?.active_products ?? null }, { label: "Projetos inativos", value: source?.inactive_projects ?? null }, { label: "Vínculos projeto-produto", value: source?.project_product_links ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.nexfy, sourceLabel: "nexfy no resumo do Core" };
    }
    case "monitoramento": {
      const source = summary.sources.monitoramento_ngv;
      return {
        metrics: [
          { label: "Projetos cadastrados", value: source?.projects_total ?? null, description: "Projetos registrados no Monitoramento. Projetos e domínios não têm relação 1:1." },
          { label: "Domínios monitorados", value: source?.domains_total ?? null, description: "Domínios incluídos na leitura agregada do Monitoramento." },
          { label: "Vencem em 30 dias", value: source?.domains_expiring_30d ?? null, description: "Domínios cuja renovação entra na janela dos próximos 30 dias." },
          { label: "Serviços com cobrança ativa", value: source?.subscriptions_active ?? null, description: "Assinaturas com cobrança ativa registradas no Monitoramento." },
          { label: "Recursos que pedem revisão", value: source?.infra_resources_attention ?? null, description: "Recursos de infraestrutura sinalizados para revisão. Este resumo não traz nomes ou URLs." },
        ],
        observedAt: source?.generated_at,
        freshness: sourceFreshness?.monitoramento_ngv,
        sourceLabel: "monitoramento-ngv no resumo do Core",
      };
    }
  }
}

export function SystemDetailView({ system, summary }: { system: SystemId; summary: NgvCoreOperationalSummary }) {
  const definition = SYSTEM_DIRECTORY[system];
  const detailTitle = system === "banco-ngv" ? "Dados do dashboard" : definition.title;
  const unavailable = summary.kind === "unavailable";
  const disabled = summary.kind === "disabled";
  const unavailableCode = "code" in summary && typeof summary.code === "string" ? summary.code : undefined;
  const details = metricsFor(system, summary);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" render={<Link href="/operacao" />}>
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Visão geral
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-primary">{definition.eyebrow}</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{detailTitle}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{definition.description}</p>
          </div>
          {disabled ? <StatusBadge variant="neutral">Resumo central desligado</StatusBadge> : unavailable ? <StatusBadge variant="warning">Leitura do Core indisponível</StatusBadge> : <StatusBadge variant={details.freshness?.is_stale ? "warning" : "neutral"}>{details.freshness ? details.freshness.is_stale ? "Leitura antiga do Core" : "Leitura recente do Core" : "Resumo agregado"}</StatusBadge>}
        </div>
      </div>

      {disabled ? (
        <section className="rounded-lg border bg-muted/20 p-5" role="status">
          <div className="flex items-start gap-3">
            <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Resumo central desligado ou não verificado</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">A leitura central não está habilitada neste ambiente. As fontes externas não foram verificadas por este resumo.</p>
            </div>
          </div>
        </section>
      ) : unavailable ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Dados preservados, leitura central indisponível</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{unavailableMessage(unavailableCode)} Nenhuma fonte local é alterada por esta falha.</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico seguro: {unavailableCode ?? "SUMMARY_UNAVAILABLE"}</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2" aria-label={`Indicadores de ${detailTitle}`}>
            {details.metrics.map((metric, index) => (
              <div key={metric.label} className={cn("flex min-h-36 flex-col bg-card p-4", details.metrics.length % 2 === 1 && index === details.metrics.length - 1 && "sm:col-span-2")}>
                <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{metric.value ?? "—"}</p>
                <p className="mt-2 text-sm font-medium">{metric.label}</p>
                {metric.description && <p className="mt-1 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">{metric.description}</p>}
                {metric.observation && <p className="mt-3 font-mono text-[11px] tabular-nums text-muted-foreground">{metric.observation}</p>}
                {metric.action && (
                  <Button variant="link" size="sm" className="mt-auto h-9 w-fit px-0 text-xs" render={<Link href={metric.action.href} />}>
                    {metric.action.label}
                  </Button>
                )}
              </div>
            ))}
          </section>
          <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" /> Fonte: {details.sourceLabel}</span>
            <span className="inline-flex items-center gap-2">Resumo agregado: {formatTimestamp(details.observedAt)}</span>
            {details.freshness && <span>Idade da leitura no Core: {details.freshness.age_hours} h</span>}
            <span>Esta idade descreve a leitura do Core, não a saúde externa. A fonte dona preserva os dados operacionais.</span>
          </section>
        </>
      )}
    </div>
  );
}
