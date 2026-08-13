"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  Grid2X2,
  ListFilter,
  RadioTower,
  Rows3,
  Search,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationCommandPreview } from "@/components/operacao/operation-command-preview";
import { compareBlockerRows } from "@/lib/operacao/blocker-order.mjs";
import { cn } from "@/lib/utils";
import type {
  OperationOffer,
  OperationSnapshot,
  OperationSource,
} from "@/lib/operacao/schema";
import type { fetchQuizAnalyticsSummary } from "@/lib/operacao/quiz-analytics-summary.mjs";
import type { fetchSpyAnalyticsSummary } from "@/lib/operacao/spy-analytics-summary.mjs";
import type { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";

type QuizAnalyticsSummary = Awaited<ReturnType<typeof fetchQuizAnalyticsSummary>>;
type SpyAnalyticsSummary = Awaited<ReturnType<typeof fetchSpyAnalyticsSummary>>;
type NgvCoreOperationalSummary = Awaited<ReturnType<typeof fetchNgvCoreOperationalSummary>>;

type ViewMode = "table" | "flow";
type StateFilter = "ALL" | OperationOffer["state"];

const STATE_META: Record<OperationOffer["state"], {
  label: string;
  variant: "neutral" | "danger" | "info" | "warning" | "success";
  icon: typeof CircleDashed;
}> = {
  PENDING: { label: "Aguardando configuração", variant: "neutral", icon: CircleDashed },
  BLOCKED: { label: "Bloqueada", variant: "danger", icon: AlertTriangle },
  IN_MOTION: { label: "Em movimento", variant: "info", icon: Activity },
  ATTENTION: { label: "Atenção", variant: "warning", icon: AlertTriangle },
  READY_FOR_REVIEW: { label: "Pronta para revisão", variant: "success", icon: CheckCircle2 },
};

const SOURCE_META: Record<OperationSource["state"], {
  label: string;
  variant: "neutral" | "danger" | "warning" | "success";
  icon: typeof CircleDashed;
}> = {
  OPERANT: { label: "Operante", variant: "success", icon: CheckCircle2 },
  DEGRADED: { label: "Degradada", variant: "warning", icon: AlertTriangle },
  UNAVAILABLE: { label: "Indisponível", variant: "danger", icon: WifiOff },
  UNVERIFIED: { label: "Não verificada", variant: "neutral", icon: CircleDashed },
};

function formatTimestamp(value: string | null): string {
  if (!value) return "PENDING";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StateBadge({ state }: { state: OperationOffer["state"] }) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <StatusBadge variant={meta.variant} className="gap-1.5">
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </StatusBadge>
  );
}

function OfferOperationalDetails({ offer }: { offer: OperationOffer }) {
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-2">
      <div>
        <dt className="font-medium text-foreground">Fonte</dt>
        <dd className="truncate" title={offer.source_status}>{offer.source_status}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">Agregado</dt>
        <dd><StateBadge state={offer.aggregated_status} /></dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">Reconciliação</dt>
        <dd>{offer.reconciliation.status}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">Próximo responsável</dt>
        <dd className="truncate" title={offer.next_owner}>{offer.next_owner}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-medium text-foreground">Métrica</dt>
        <dd>{offer.metric_binding.status} · {offer.metric_binding.detail}</dd>
      </div>
    </dl>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
        {eyebrow}
      </p>
      <h2 id={id} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function SummaryBand({ snapshot }: { snapshot: OperationSnapshot }) {
  const { offers } = snapshot;
  const isRuntimeSource = snapshot.source === "banco-ngv-runtime";
  const values = [
    ...(isRuntimeSource
      ? [
          { label: "Ofertas recentes", value: offers.length, icon: RadioTower },
          { label: "Produção · fases 1–4", value: offers.filter((offer) => offer.phase >= 1 && offer.phase <= 4).length, icon: Activity },
          { label: "Produto · fase 5", value: offers.filter((offer) => offer.phase === 5).length, icon: Database },
          { label: "Campanha/validação · fases 6–7", value: offers.filter((offer) => offer.phase >= 6 && offer.phase <= 7).length, icon: CheckCircle2 },
        ]
      : [
          { label: "Observadas", value: offers.length, icon: RadioTower },
          { label: "Em movimento", value: offers.filter((offer) => offer.state === "IN_MOTION").length, icon: Activity },
          { label: "Aguardando configuração", value: offers.filter((offer) => offer.blockers.some((blocker) => blocker.severity === "PENDING")).length, icon: CircleDashed },
          { label: "Bloqueadas confirmadas", value: offers.filter((offer) => offer.state === "BLOCKED").length, icon: AlertTriangle },
        ]),
  ];

  return (
    <section aria-label="Resumo da operação" aria-live="polite" className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {values.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "flex min-h-24 items-center gap-3 px-4 py-4 sm:px-6",
              index % 2 === 1 && "border-l",
              index >= 2 && "border-t lg:border-t-0",
              index === 2 && "lg:border-l",
            )}
          >
            <item.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums leading-none sm:text-3xl">{item.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuizAnalyticsCard({ summary }: { summary: QuizAnalyticsSummary }) {
  const unavailable = summary.source === "UNAVAILABLE";
  const values = [["Aguardando deploy", summary.counts.awaiting_deploy], ["Instalados", summary.counts.installed], ["Recebendo eventos", summary.counts.receiving_events]] as const;
  return <section aria-labelledby="quiz-analytics-summary" className="rounded-lg border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary">Quiz Analytics</p><h2 id="quiz-analytics-summary" className="mt-1 text-lg font-semibold">Resumo externo, somente leitura</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Fonte externa factual; não altera fases, lifecycle ou ofertas do Banco NGV.</p></div><StatusBadge variant={unavailable ? "warning" : summary.source === "UNVERIFIED" ? "neutral" : "success"}>{unavailable ? "Fonte indisponível" : summary.source === "UNVERIFIED" ? "Fonte não verificada" : "Fonte externa"}</StatusBadge></div>
    <div className="mt-5 grid grid-cols-3 divide-x border-y py-4 text-center">{values.map(([label, value]) => <div key={label} className="px-2"><p className="font-mono text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
    <p className="mt-4 text-xs text-muted-foreground">Vínculos sem ID positivo único conhecido no snapshot, projetos de teste e duplicidades permanecem PENDING; isso não é bloqueio operacional.</p>
  </section>;
}

function SpyAnalyticsCard({ summary }: { summary: SpyAnalyticsSummary }) {
  const unavailable = summary.source === "UNAVAILABLE";
  const unverified = summary.source === "UNVERIFIED";
  const value = (item: number | null) => item === null ? "—" : item;
  const values = [
    ["Ofertas observadas", value(summary.offers_observed)],
    ["Leituras observadas", value(summary.readings_observed)],
    ["Dias com leitura", value(summary.distinct_reading_days)],
    ["Pronta para modelar", value(summary.ready_to_model)],
  ] as const;
  return <section aria-labelledby="spy-analytics-summary" className="rounded-lg border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary">Spy Analytics</p><h2 id="spy-analytics-summary" className="mt-1 text-lg font-semibold">Resumo agregado, somente leitura</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Janela fixa de 30 dias; não altera snapshot, lifecycle ou reconciliação do Banco NGV.</p></div><StatusBadge variant={unavailable ? "warning" : unverified ? "neutral" : "success"}>{unavailable ? "Fonte indisponível" : unverified ? "Fonte não verificada" : summary.ready_to_model > 0 ? "Pronta para modelar" : "Ainda não pronta"}</StatusBadge></div>
    <div className="mt-5 grid grid-cols-2 divide-x divide-y border-y py-4 text-center lg:grid-cols-4 lg:divide-y-0">{values.map(([label, item]) => <div key={label} className="px-2 py-2 lg:py-0"><p className="font-mono text-2xl font-semibold tabular-nums">{item}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
    <p className="mt-4 text-xs text-muted-foreground">A fonte é consultada somente no servidor. Ausência, contrato inválido, timeout ou erro de rede não são tratados como dados observados.</p>
  </section>;
}

function NgvCoreSummaryCard({ summary }: { summary: NgvCoreOperationalSummary }) {
  const unavailable = summary.kind === "unavailable";
  const unverified = summary.kind === "disabled";
  const value = (item: number | null | undefined) => item ?? "—";
  const sources = [
    { label: "Spy", observedAt: summary.sources.spy?.generated_at, values: [["ofertas", value(summary.sources.spy?.offers_observed)], ["leituras", value(summary.sources.spy?.readings_observed)]] },
    { label: "Nexfy", observedAt: summary.sources.nexfy?.generated_at, values: [["projetos ativos", value(summary.sources.nexfy?.active_projects)], ["produtos ativos", value(summary.sources.nexfy?.active_products)]] },
    { label: "Banco NGV", observedAt: summary.sources.banco_ngv?.generated_at, values: [["ofertas rastreadas", value(summary.sources.banco_ngv?.offer_tracking_count)], ["métricas", value(summary.sources.banco_ngv?.metrics_snapshot_count)]] },
    { label: "Quiz", observedAt: summary.sources.quiz_analytics?.generated_at, values: [["projetos", value(summary.sources.quiz_analytics?.project_count)], ["com eventos", value(summary.sources.quiz_analytics?.receiving_events_count)]] },
    { label: "Apps Ofertas", observedAt: summary.sources.apps_ofertas?.generated_at, values: [["ofertas", value(summary.sources.apps_ofertas?.offers_configured)], ["acessos ativos", value(summary.sources.apps_ofertas?.access_active)]] },
    { label: "Cursos", observedAt: summary.sources.plataforma_cursos?.generated_at, values: [["cursos", value(summary.sources.plataforma_cursos?.courses_total)], ["acessos ativos", value(summary.sources.plataforma_cursos?.entitlements_active)]] },
  ];
  return <section aria-labelledby="ngv-core-summary" className="overflow-hidden rounded-lg border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-6"><div><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary">NGV Core</p><h2 id="ngv-core-summary" className="mt-1 text-lg font-semibold">Fontes sincronizadas, somente leitura</h2><p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">Última projeção agregada de cada sistema; ausência de uma fonte permanece explícita e não altera a operação local.</p></div><StatusBadge variant={unavailable ? "warning" : unverified ? "neutral" : "success"}>{unavailable ? "Core indisponível" : unverified ? "Core não verificado" : "Core sincronizado"}</StatusBadge></div>
    <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">{sources.map((source, index) => <article key={source.label} className={cn("min-h-32 p-4", index >= 2 && "sm:border-t xl:border-t-0")}><div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">{source.label}</h3><time className="font-mono text-[10px] tabular-nums text-muted-foreground" dateTime={source.observedAt ?? undefined}>{formatTimestamp(source.observedAt ?? null)}</time></div><dl className="mt-4 grid grid-cols-2 gap-3">{source.values.map(([label, metric]) => <div key={label}><dd className="font-mono text-xl font-semibold tabular-nums">{metric}</dd><dt className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</dt></div>)}</dl></article>)}</div>
  </section>;
}

function FlightPipeline({
  snapshot,
  offers,
  selectedPhase,
  onSelect,
}: {
  snapshot: OperationSnapshot;
  offers: OperationOffer[];
  selectedPhase: number | "ALL";
  onSelect: (phase: number | "ALL") => void;
}) {
  return (
    <nav aria-label="Fases da operação" className="relative">
      <div className="absolute left-5 top-0 hidden h-full w-px bg-primary/30 max-md:block" aria-hidden="true" />
      <div className="absolute left-8 right-8 top-6 hidden h-px bg-primary/30 md:block" aria-hidden="true" />
      <ol className="relative grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {snapshot.phases.map(({ phase, label }) => {
          const phaseOffers = offers.filter((offer) => offer.phase === phase);
          const blocked = phaseOffers.filter((offer) => offer.state === "BLOCKED").length;
          const selected = selectedPhase === phase;
          return (
            <li key={phase} className="relative pl-12 md:pl-0">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? "ALL" : phase)}
                className={cn(
                  "group flex min-h-20 w-full items-center gap-3 rounded-md border bg-card p-3 text-left outline-none transition-colors duration-150 md:min-h-28 md:flex-col md:items-start md:gap-2",
                  "hover:border-primary/30 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected && "border-primary bg-accent",
                )}
              >
                <span className={cn(
                  "absolute left-2.5 top-5 z-10 grid size-5 place-items-center rounded-sm border bg-background font-mono text-[10px] font-semibold tabular-nums md:static md:size-7",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                )}>
                  {String(phase).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 md:flex-none">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className="mt-1 block font-mono text-xs tabular-nums text-muted-foreground">
                    {phaseOffers.length} oferta{phaseOffers.length === 1 ? "" : "s"}
                  </span>
                </span>
                {blocked > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger">
                    <AlertTriangle className="size-3" aria-hidden="true" /> {blocked}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CircleDashed className="size-3" aria-hidden="true" /> {phase === 0 && phaseOffers.length > 0 ? "aguardando" : "sem exceção"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function OfferCards({ offers }: { offers: OperationOffer[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => (
        <article key={offer.offer_id} className={cn(
          "border-l-[3px] bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40",
          offer.state === "BLOCKED" ? "border-l-danger" : "border-l-primary/40",
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold" title={offer.display_name}>{offer.display_name}</h3>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={offer.offer_id}>{offer.offer_id}</p>
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-primary">F{offer.phase}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StateBadge state={offer.state} />
            <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{offer.language}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {offer.blockers[0]?.detail ?? "Sem bloqueio confirmado; etapa baseada na evidência disponível."}
          </p>
          <OfferOperationalDetails offer={offer} />
          <time className="mt-3 block font-mono text-[11px] tabular-nums text-muted-foreground" dateTime={offer.last_evidence_at ?? undefined}>
            Evidência: {formatTimestamp(offer.last_evidence_at)}
          </time>
        </article>
      ))}
    </div>
  );
}

function OfferDesk({ offers, mode }: { offers: OperationOffer[]; mode: ViewMode }) {
  if (offers.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center border border-dashed p-8 text-center" role="status">
        <ListFilter className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Nenhuma oferta corresponde aos filtros</p>
        <p className="mt-1 text-sm text-muted-foreground">A visão não cria nem altera registros.</p>
      </div>
    );
  }

  if (mode === "flow") return <OfferCards offers={offers} />;

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 h-9 bg-muted px-4">Oferta</th>
                <th scope="col" className="h-9 px-3">Fase</th>
                <th scope="col" className="h-9 px-3">Estado</th>
                <th scope="col" className="h-9 px-3">Etapa / evidência</th>
                <th scope="col" className="h-9 px-3">Última evidência</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.offer_id} className={cn(
                  "group border-b border-l-2 border-l-transparent odd:bg-muted/20 hover:border-l-primary hover:bg-accent/40",
                  offer.state === "BLOCKED" && "border-l-danger",
                )}>
                  <td className="sticky left-0 z-[1] h-14 bg-background px-4 group-hover:bg-accent">
                    <p className="max-w-56 truncate font-medium" title={offer.display_name}>{offer.display_name}</p>
                    <p className="max-w-56 truncate font-mono text-[10px] text-muted-foreground" title={offer.offer_id}>{offer.offer_id}</p>
                  </td>
                  <td className="px-3 font-mono text-xs tabular-nums">{String(offer.phase).padStart(2, "0")}</td>
                  <td className="px-3"><StateBadge state={offer.state} /></td>
                  <td className="max-w-sm px-3 text-xs text-muted-foreground">
                    <p>{offer.blockers[0]?.detail ?? "Sem bloqueio confirmado"}</p>
                    <p className="mt-1">Fonte: {offer.source_status} · Agregado: {STATE_META[offer.aggregated_status].label}</p>
                    <p className="mt-1">Reconciliação: {offer.reconciliation.status} · Próximo responsável: {offer.next_owner}</p>
                    <p className="mt-1">Métrica: {offer.metric_binding.status}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                    <time dateTime={offer.last_evidence_at ?? undefined}>{formatTimestamp(offer.last_evidence_at)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="md:hidden"><OfferCards offers={offers} /></div>
    </>
  );
}

function BlockersPanel({ offers, generatedAt }: { offers: OperationOffer[]; generatedAt: string }) {
  const blockerRows = offers
    .flatMap((offer) => offer.blockers
      .filter((blocker) => blocker.severity === "BLOCKED")
      .map((blocker) => ({ offer, blocker })))
    .sort(compareBlockerRows);
  return (
    <section aria-labelledby="operation-blockers" className="rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-danger">Exceções</p>
          <h2 id="operation-blockers" className="mt-1 text-lg font-semibold">Bloqueios confirmados</h2>
        </div>
        <span className="font-mono text-2xl font-semibold tabular-nums text-danger">{blockerRows.length}</span>
      </div>
      {blockerRows.length === 0 ? (
        <div className="mt-6 flex gap-3 border-t pt-5" role="status">
          <ShieldCheck className="size-5 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Nenhum bloqueio confirmado nesta leitura.</p>
            <time className="mt-1 block font-mono text-[11px] text-muted-foreground" dateTime={generatedAt}>{formatTimestamp(generatedAt)}</time>
          </div>
        </div>
      ) : (
        <ul className="mt-5 divide-y">
          {blockerRows.map(({ offer, blocker }, index) => (
            <li key={`${offer.offer_id}-${blocker.code}-${index}`} className="border-l-[3px] border-l-danger py-3 pl-3">
              <p className="text-sm font-medium">{offer.display_name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{blocker.detail}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-danger">
                {blocker.severity} · {blocker.code} · {blocker.source}
              </p>
              <time className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground" dateTime={blocker.occurred_at ?? undefined}>
                Evidência: {formatTimestamp(blocker.occurred_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SourcesHealth({ sources }: { sources: OperationSource[] }) {
  return (
    <section aria-labelledby="operation-sources" className="rounded-lg border bg-card p-4 sm:p-6">
      <SectionHeading id="operation-sources" eyebrow="Fontes" title="Saúde da leitura" description="Presença local não é prova de conexão externa; estados não verificados permanecem neutros." />
      <ul className="mt-5 space-y-2 md:hidden" aria-label="Saúde das fontes">
        {sources.map((source) => {
          const meta = SOURCE_META[source.state];
          const Icon = meta.icon;
          return (
            <li key={source.id} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{source.label}</p>
                <StatusBadge variant={meta.variant} className="gap-1.5"><Icon className="size-3" aria-hidden="true" />{meta.label}</StatusBadge>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Cobertura</dt>
                <dd className="min-w-0 text-right font-mono tabular-nums">{source.coverage}</dd>
                <dt className="text-muted-foreground">Última leitura</dt>
                <dd className="min-w-0 text-right font-mono tabular-nums"><time dateTime={source.last_read_at ?? undefined}>{formatTimestamp(source.last_read_at)}</time></dd>
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">{source.detail}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="h-8">Fonte</th>
              <th scope="col" className="h-8">Estado</th>
              <th scope="col" className="h-8">Cobertura</th>
              <th scope="col" className="h-8">Última leitura</th>
              <th scope="col" className="h-8">Evidência</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const meta = SOURCE_META[source.state];
              const Icon = meta.icon;
              return (
                <tr key={source.id} className="border-b last:border-0">
                  <td className="h-12 font-medium">{source.label}</td>
                  <td><StatusBadge variant={meta.variant} className="gap-1.5"><Icon className="size-3" aria-hidden="true" />{meta.label}</StatusBadge></td>
                  <td className="font-mono text-xs tabular-nums text-muted-foreground">{source.coverage}</td>
                  <td className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground"><time dateTime={source.last_read_at ?? undefined}>{formatTimestamp(source.last_read_at)}</time></td>
                  <td className="max-w-xs text-xs text-muted-foreground">{source.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditTimeline({ snapshot }: { snapshot: OperationSnapshot }) {
  return (
    <section aria-labelledby="operation-audit" className="rounded-lg border bg-card p-4 sm:p-6">
      <SectionHeading id="operation-audit" eyebrow="Auditoria" title="Últimas evidências" description="Eventos sanitizados do ledger local; detalhes brutos e identificadores pessoais não são projetados." />
      {snapshot.events.length === 0 ? (
        <div className="mt-6 border border-dashed p-6 text-center" role="status">
          <Clock3 className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Nenhum evento sanitizado disponível.</p>
        </div>
      ) : (
        <ol className="relative mt-6 space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-primary/30">
          {snapshot.events.map((event) => (
            <li key={event.event_id} className="relative pl-6">
              <span className="absolute left-0 top-1.5 size-[11px] border border-primary bg-background" aria-hidden="true" />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-sm font-medium">{event.event_type.replaceAll("_", " ")}</p>
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">F{event.phase} · {event.source}</span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={event.offer_id}>{event.offer_id} · {event.state}</p>
              <code
                className="mt-1 block max-w-full select-all truncate font-mono text-[10px] text-muted-foreground"
                title={event.event_id}
                aria-label={`ID do evento ${event.event_id}`}
              >
                {event.event_id}
              </code>
              <time className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground" dateTime={event.occurred_at}>{formatTimestamp(event.occurred_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function OperationView({ snapshot, stale, quizAnalytics, spyAnalytics, ngvCore }: { snapshot: OperationSnapshot; stale: boolean; quizAnalytics: QuizAnalyticsSummary; spyAnalytics: SpyAnalyticsSummary; ngvCore: NgvCoreOperationalSummary }) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [phaseFilter, setPhaseFilter] = useState<number | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const isRuntimeSource = snapshot.source === "banco-ngv-runtime";

  const filteredOffers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return snapshot.offers.filter((offer) => {
      const matchesQuery = !normalizedQuery || `${offer.display_name} ${offer.offer_id} ${offer.offer_slug}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      const matchesState = stateFilter === "ALL" || offer.state === stateFilter;
      const matchesPhase = phaseFilter === "ALL" || offer.phase === phaseFilter;
      return matchesQuery && matchesState && matchesPhase;
    });
  }, [phaseFilter, query, snapshot.offers, stateFilter]);

  return (
    <div className="space-y-12 pb-12">
      <header className="relative overflow-hidden border-b pb-8 pt-2">
        <div className="absolute bottom-0 left-0 h-px w-full bg-primary/30" aria-hidden="true" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="info" className="gap-1.5"><RadioTower className="size-3" aria-hidden="true" />Somente leitura</StatusBadge>
              {isRuntimeSource && <StatusBadge variant="neutral">Últimos 30 dias</StatusBadge>}
              {stale && <StatusBadge variant="warning" className="gap-1.5"><Clock3 className="size-3" aria-hidden="true" />Dados antigos</StatusBadge>}
            </div>
            <h1 className="mt-5 max-w-4xl text-[clamp(2.25rem,3.4vw,3.5rem)] font-bold leading-[0.98] tracking-[-0.035em]">
              Torre de controle da operação
            </h1>
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isRuntimeSource
                ? "Ofertas criadas nos últimos 30 dias, organizadas pela etapa mais avançada comprovada — sem executar ou alterar sistemas."
                : "Uma linha de voo para localizar ofertas, exceções e a evidência que sustenta cada estado — sem executar ou alterar sistemas."}
            </p>
          </div>
          <div className="shrink-0 border-l-2 border-primary/40 pl-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Última consolidação</p>
            <time className="mt-1 block font-mono text-sm font-medium tabular-nums" dateTime={snapshot.generated_at}>{formatTimestamp(snapshot.generated_at)}</time>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{snapshot.source}</p>
          </div>
        </div>
      </header>

      <SummaryBand snapshot={snapshot} />
      <NgvCoreSummaryCard summary={ngvCore} />
      <QuizAnalyticsCard summary={quizAnalytics} />
      <SpyAnalyticsCard summary={spyAnalytics} />

      <section aria-labelledby="operation-pipeline" className="space-y-6">
        <SectionHeading id="operation-pipeline" eyebrow="Linha 00—07" title="Pipeline operacional" description="Cada estação representa uma fase comprovável. Selecione uma fase para filtrar a mesa sem alterar a fonte." />
        <FlightPipeline snapshot={snapshot} offers={snapshot.offers} selectedPhase={phaseFilter} onSelect={setPhaseFilter} />
      </section>

      <section aria-labelledby="operation-desk" className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionHeading id="operation-desk" eyebrow="Mesa" title="Ofertas em observação" description={`${filteredOffers.length} de ${snapshot.offers.length} ofertas correspondem à leitura local atual.`} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search" aria-label="Filtros da operação">
            <label className="relative min-w-0 sm:w-64">
              <span className="sr-only">Buscar oferta</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar oferta ou ID" className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label>
              <span className="sr-only">Filtrar por estado</span>
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as StateFilter)} className="h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="ALL">Todos os estados</option>
                {Object.entries(STATE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>
            <div className="flex rounded-md border" aria-label="Modo de visualização">
              <button type="button" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={cn("grid size-11 place-items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", viewMode === "table" && "bg-primary text-primary-foreground")} title="Tabela"><Rows3 className="size-4" aria-hidden="true" /><span className="sr-only">Tabela</span></button>
              <button type="button" aria-pressed={viewMode === "flow"} onClick={() => setViewMode("flow")} className={cn("grid size-11 place-items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", viewMode === "flow" && "bg-primary text-primary-foreground")} title="Fluxo"><Grid2X2 className="size-4" aria-hidden="true" /><span className="sr-only">Fluxo</span></button>
            </div>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8"><OfferDesk offers={filteredOffers} mode={viewMode} /></div>
          <div className="xl:col-span-4"><BlockersPanel offers={filteredOffers} generatedAt={snapshot.generated_at} /></div>
        </div>
        {filteredOffers.length > 0 && <OperationCommandPreview offers={filteredOffers} generatedAt={snapshot.generated_at} />}
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6"><SourcesHealth sources={snapshot.sources} /></div>
        <div className="xl:col-span-6"><AuditTimeline snapshot={snapshot} /></div>
      </div>

      <footer className="flex items-center gap-2 border-t pt-6 text-xs text-muted-foreground">
        <Database className="size-4" aria-hidden="true" />
        {isRuntimeSource
          ? "Consulta read-only · Banco NGV · janela móvel de 30 dias"
          : "Snapshot versionado · projeção sanitizada · nenhuma leitura externa em runtime."}
      </footer>
    </div>
  );
}

export function OperationErrorState({
  affectedSources = [],
  attemptedAt,
}: {
  affectedSources?: string[];
  attemptedAt: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-xl border-l-[3px] border-l-danger bg-card p-6 ring-1 ring-foreground/10" role="alert">
        <WifiOff className="size-6 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Não foi possível consolidar a operação</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A consulta read-only ao Banco NGV não foi concluída. Nenhuma oferta histórica foi exibida como fallback e nenhum dado foi alterado.
        </p>
        <dl className="mt-4 grid gap-2 border-t pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Fontes afetadas conhecidas</dt>
            <dd className="mt-1 font-mono text-xs">{affectedSources.length > 0 ? affectedSources.join(", ") : "PENDING"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Horário da tentativa</dt>
            <dd className="mt-1 font-mono text-xs"><time dateTime={attemptedAt}>{formatTimestamp(attemptedAt)}</time></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
