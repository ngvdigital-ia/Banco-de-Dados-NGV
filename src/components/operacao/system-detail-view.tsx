import Link from "next/link";
import { ArrowLeft, CircleDashed, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SYSTEM_DIRECTORY, type SystemId } from "@/lib/operacao/system-directory";
import type { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";

type NgvCoreOperationalSummary = Awaited<ReturnType<typeof fetchNgvCoreOperationalSummary>>;

type Metric = { label: string; value: number | string | null };

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

function metricsFor(system: SystemId, summary: NgvCoreOperationalSummary): { metrics: Metric[]; observedAt: string | null | undefined; freshness: { is_stale: boolean; age_hours: number } | undefined } {
  const sourceFreshness = summary.freshness?.by_source;
  switch (system) {
    case "banco-ngv": {
      const source = summary.sources.banco_ngv;
      return { metrics: [{ label: "Ofertas rastreadas", value: source?.offer_tracking_count ?? null }, { label: "Snapshots de métricas", value: source?.metrics_snapshot_count ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.banco_ngv };
    }
    case "apps-ofertas": {
      const source = summary.sources.apps_ofertas;
      return { metrics: [{ label: "Ofertas", value: source?.offers_configured ?? null }, { label: "Acessos ativos", value: source?.access_active ?? null }, { label: "Compras", value: source?.purchases_total ?? null }, { label: "Grants ativos", value: source?.product_grants_active ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.apps_ofertas };
    }
    case "cursos": {
      const source = summary.sources.plataforma_cursos;
      return { metrics: [{ label: "Cursos", value: source?.courses_total ?? null }, { label: "Acessos ativos", value: source?.entitlements_active ?? null }, { label: "Entitlements", value: source?.entitlements_total ?? null }, { label: "Última atividade", value: source?.latest_progress_at ? formatTimestamp(source.latest_progress_at) : null }], observedAt: source?.generated_at, freshness: sourceFreshness?.plataforma_cursos };
    }
    case "spy": {
      const source = summary.sources.spy;
      return { metrics: [{ label: "Ofertas observadas", value: source?.offers_observed ?? null }, { label: "Leituras", value: source?.readings_observed ?? null }, { label: "Dias com leitura", value: source?.distinct_reading_days ?? null }, { label: "Prontas para modelar", value: source?.ready_to_model ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.spy };
    }
    case "quiz": {
      const source = summary.sources.quiz_analytics;
      return { metrics: [{ label: "Projetos", value: source?.project_count ?? null }, { label: "Instalados", value: source?.installed_count ?? null }, { label: "Com eventos", value: source?.receiving_events_count ?? null }, { label: "Com oferta vinculada", value: source?.projects_with_offer_id_count ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.quiz_analytics };
    }
    case "nexfy": {
      const source = summary.sources.nexfy;
      return { metrics: [{ label: "Projetos ativos", value: source?.active_projects ?? null }, { label: "Produtos ativos", value: source?.active_products ?? null }, { label: "Projetos inativos", value: source?.inactive_projects ?? null }, { label: "Vínculos projeto-produto", value: source?.project_product_links ?? null }], observedAt: source?.generated_at, freshness: sourceFreshness?.nexfy };
    }
    case "monitoramento": {
      const source = summary.sources.monitoramento_ngv;
      return {
        metrics: [
          { label: "Projetos", value: source?.projects_total ?? null },
          { label: "Projetos em atenção", value: source?.projects_attention ?? null },
          { label: "Domínios", value: source?.domains_total ?? null },
          { label: "Vencendo em 30 dias", value: source?.domains_expiring_30d ?? null },
          { label: "Assinaturas ativas", value: source?.subscriptions_active ?? null },
          { label: "Infra em atenção", value: source?.infra_resources_attention ?? null },
        ],
        observedAt: source?.generated_at,
        freshness: sourceFreshness?.monitoramento_ngv,
      };
    }
  }
}

export function SystemDetailView({ system, summary }: { system: SystemId; summary: NgvCoreOperationalSummary }) {
  const definition = SYSTEM_DIRECTORY[system];
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
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{definition.title}</h1>
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
          <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-3" aria-label={`Indicadores de ${definition.title}`}>
            {details.metrics.map((metric) => (
              <div key={metric.label} className="min-h-28 bg-card p-4">
                <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{metric.value ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </section>
          <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" /> Resumo agregado: {formatTimestamp(details.observedAt)}</span>
            {details.freshness && <span>Idade da leitura no Core: {details.freshness.age_hours} h</span>}
            <span>Esta idade descreve a leitura do Core, não a saúde externa. A fonte dona preserva os dados operacionais.</span>
          </section>
        </>
      )}
    </div>
  );
}
