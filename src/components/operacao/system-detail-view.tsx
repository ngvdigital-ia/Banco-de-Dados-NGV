import Link from "next/link";
import { ArrowLeft, Clock3, ShieldAlert } from "lucide-react";
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
  }
}

export function SystemDetailView({ system, summary }: { system: SystemId; summary: NgvCoreOperationalSummary }) {
  const definition = SYSTEM_DIRECTORY[system];
  const unavailable = summary.kind !== "success";
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
          {unavailable ? <StatusBadge variant="warning">Core indisponível</StatusBadge> : <StatusBadge variant={details.freshness?.is_stale ? "warning" : "success"}>{details.freshness?.is_stale ? "Dados desatualizados" : "Dados atualizados"}</StatusBadge>}
        </div>
      </div>

      {unavailable ? (
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
          <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label={`Indicadores de ${definition.title}`}>
            {details.metrics.map((metric, index) => (
              <div key={metric.label} className={`min-h-28 p-4 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
                <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{metric.value ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </section>
          <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" /> Leitura: {formatTimestamp(details.observedAt)}</span>
            {details.freshness && <span>Idade do dado: {details.freshness.age_hours} h</span>}
            <span>Core é autoridade de saúde/freshness; a fonte dona preserva os dados operacionais.</span>
          </section>
        </>
      )}
    </div>
  );
}
