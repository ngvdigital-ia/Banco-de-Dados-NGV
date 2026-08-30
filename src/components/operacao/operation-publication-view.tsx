import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  CircleX,
  Clock3,
  Globe2,
  MapPinCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  type CommerceReadbackRecord,
  type OperationCommerceReadbackProjection,
} from "@/lib/operacao/commerce-readback-module";
import {
  type LifecycleEvidenceRecord,
  type OperationLifecycleEvidenceProjection,
} from "@/lib/operacao/lifecycle-evidence-module";
import {
  type OperationPublicationProjection,
  type PublicationRecord,
} from "@/lib/operacao/publication-module";
import { TRANSVERSAL_OPERATION_MODULE_DIRECTORY } from "@/lib/operacao/system-directory";

const TARGET_LABELS: Record<string, string> = {
  domain: "Domínio",
  vsl: "VSL",
  quiz: "Quiz",
  whites: "White pages",
  custom: "Outro endereço",
};

const LIFECYCLE_FACETS = [
  { key: "scope", label: "Escopo" },
  { key: "local", label: "Local" },
  { key: "visual", label: "Visual" },
  { key: "public_url", label: "URL pública" },
  { key: "checkout", label: "Checkout" },
  { key: "tracking", label: "Tracking" },
  { key: "production", label: "Produção" },
] as const;

type LifecycleState = LifecycleEvidenceRecord["state"];
type LifecycleFacetKey = (typeof LIFECYCLE_FACETS)[number]["key"];
type LifecycleFacetState = LifecycleEvidenceRecord["facets"]["scope"]["state"];
type CommerceState = CommerceReadbackRecord["state"];

const LIFECYCLE_STATE_META: Record<
  LifecycleState,
  { label: string; variant: "success" | "warning" | "danger" | "neutral"; icon: typeof CheckCircle2 }
> = {
  PASS: { label: "7/7 provas válidas", variant: "success", icon: CheckCircle2 },
  FAIL: { label: "Falha comprovada", variant: "danger", icon: CircleX },
  STALE: { label: "Prova vencida", variant: "warning", icon: Clock3 },
  DIVERGENT: { label: "Identidade divergente", variant: "warning", icon: AlertTriangle },
  PENDING: { label: "Aguardando provas", variant: "neutral", icon: CircleDashed },
};

const FACET_STATE_META: Record<
  LifecycleFacetState,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  PASS: { label: "Válida", variant: "success" },
  FAIL: { label: "Falha", variant: "danger" },
  STALE: { label: "Vencida", variant: "warning" },
  PENDING: { label: "Pendente", variant: "neutral" },
};

const COMMERCE_STATE_META: Record<
  CommerceState,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info"; icon: typeof CheckCircle2 }
> = {
  READBACK_OBSERVED: { label: "Venda e acesso confirmados", variant: "success", icon: CheckCircle2 },
  ACCESS_MISSING: { label: "Venda sem acesso confirmado", variant: "warning", icon: AlertTriangle },
  QUARANTINED: { label: "Evento em quarentena", variant: "warning", icon: ShieldAlert },
  PENDING_MAPPING: { label: "Produto sem mapeamento", variant: "warning", icon: CircleDashed },
  EXTERNAL: { label: "Entrega externa", variant: "neutral", icon: Globe2 },
  SALE_OBSERVED: { label: "Venda observada", variant: "info", icon: MapPinCheck },
  PENDING_SALE: { label: "Venda ainda não observada", variant: "neutral", icon: CircleDashed },
  SOURCE_STALE: { label: "Fonte desatualizada", variant: "warning", icon: Clock3 },
  PENDING: { label: "Aguardando dados", variant: "neutral", icon: CircleDashed },
  DIVERGENT: { label: "Identidade divergente", variant: "warning", icon: AlertTriangle },
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function freshnessLabel(value: string | null): string {
  if (!value) return "Sem registros canônicos";
  const ageHours = Math.max(0, Math.floor((Date.now() - new Date(value).valueOf()) / 3_600_000));
  return `${ageHours} h desde a última atualização local`;
}

function LocalRegistrationBadge({ state }: { state: PublicationRecord["localRegistrationState"] }) {
  return state === "REGISTERED" ? (
    <StatusBadge variant="info" className="gap-1.5">
      <MapPinCheck className="size-3" aria-hidden="true" />
      Registrado localmente
    </StatusBadge>
  ) : (
    <StatusBadge variant="neutral" className="gap-1.5">
      <CircleDashed className="size-3" aria-hidden="true" />
      Pendente local
    </StatusBadge>
  );
}

function LifecycleStateBadge({ state }: { state: LifecycleState }) {
  const meta = LIFECYCLE_STATE_META[state];
  const Icon = meta.icon;
  return (
    <StatusBadge variant={meta.variant} className="gap-1.5">
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </StatusBadge>
  );
}

function FacetBadge({ state }: { state: LifecycleFacetState }) {
  const meta = FACET_STATE_META[state];
  return <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>;
}

function CommerceStateBadge({ state }: { state: CommerceState }) {
  const meta = COMMERCE_STATE_META[state];
  const Icon = meta.icon;
  return (
    <StatusBadge variant={meta.variant} className="gap-1.5">
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </StatusBadge>
  );
}

function OfferReference({ record }: { record: PublicationRecord }) {
  if (record.offerId !== "PENDING") {
    return <p className="font-mono text-xs font-medium tabular-nums">{record.offerId}</p>;
  }
  return (
    <div>
      <StatusBadge variant="neutral">PENDING</StatusBadge>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        Banco #{record.offerTrackingId} · identidade pendente
      </p>
    </div>
  );
}

function pendingLifecycleRecord(record: PublicationRecord): LifecycleEvidenceRecord {
  return {
    offerTrackingId: record.offerTrackingId,
    offerId: record.offerId,
    identityState: record.offerId === "PENDING" ? "IDENTITY_PENDING" : "CONFIRMED",
    state: "PENDING",
    facets: {
      scope: { state: "PENDING", observedAt: null },
      local: { state: "PENDING", observedAt: null },
      visual: { state: "PENDING", observedAt: null },
      public_url: { state: "PENDING", observedAt: null },
      checkout: { state: "PENDING", observedAt: null },
      tracking: { state: "PENDING", observedAt: null },
      production: { state: "PENDING", observedAt: null },
    },
  };
}

function pendingCommerceRecord(record: PublicationRecord): CommerceReadbackRecord {
  return {
    offerTrackingId: record.offerTrackingId,
    identityState: record.offerId === "PENDING" ? "IDENTITY_PENDING" : "CONFIRMED",
    state: "PENDING",
    metrics: {
      catalog_product_count: 0,
      mapped_product_count: 0,
      sale_count: 0,
      active_access_count: 0,
      quarantine_count: 0,
      readback_count: 0,
    },
  };
}

function countPassingFacets(record: LifecycleEvidenceRecord): number {
  return LIFECYCLE_FACETS.filter(({ key }) => record.facets[key].state === "PASS").length;
}

function LifecycleFacetDetails({ record }: { record: LifecycleEvidenceRecord }) {
  return (
    <details className="mt-3 rounded-md border bg-muted/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span>Detalhar sete provas</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{countPassingFacets(record)}/7</span>
      </summary>
      <dl className="grid gap-px border-t bg-border sm:grid-cols-2 xl:grid-cols-4">
        {LIFECYCLE_FACETS.map(({ key, label }) => {
          const facet = record.facets[key as LifecycleFacetKey];
          return (
            <div key={key} className="bg-card px-3 py-3">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <FacetBadge state={facet.state} />
                {facet.observedAt ? (
                  <time dateTime={facet.observedAt} className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatTimestamp(facet.observedAt)}
                  </time>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

function LifecycleAvailability({ lifecycle }: { lifecycle: OperationLifecycleEvidenceProjection }) {
  if (lifecycle.kind === "disabled") {
    return (
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3" role="status">
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Integração ainda desligada</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O registro local continua visível. As provas do Core seguem como PENDING até a integração ser habilitada.
          </p>
        </div>
      </div>
    );
  }
  if (lifecycle.kind === "unavailable") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/5 p-3" role="status">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Core indisponível, estados não confirmados</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Esta leitura não transforma ausência de resposta em falha de deploy, URL pública, checkout, tracking ou produção.
          </p>
        </div>
      </div>
    );
  }
  return (
    <StatusBadge variant="info" className="max-w-full gap-1.5 whitespace-normal text-left">
      <Clock3 className="size-3 shrink-0" aria-hidden="true" />
      <span>
        Core lido em <time dateTime={lifecycle.sourceFreshness.generatedAt} className="font-mono tabular-nums">{formatTimestamp(lifecycle.sourceFreshness.generatedAt)}</time>
      </span>
    </StatusBadge>
  );
}

function CommerceAvailability({ commerce }: { commerce: OperationCommerceReadbackProjection }) {
  if (commerce.kind === "disabled") {
    return (
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3" role="status">
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Leitura comercial ainda desligada</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Esta tela não infere vendas, acessos, mapeamentos ou quarentenas enquanto a leitura privada do Core não estiver habilitada.
          </p>
        </div>
      </div>
    );
  }
  if (commerce.kind === "unavailable") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/5 p-3" role="status">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Core comercial indisponível, dados não confirmados</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A ausência desta leitura não prova nem invalida uma venda, um acesso, um mapeamento ou uma entrega.
          </p>
        </div>
      </div>
    );
  }
  return (
    <StatusBadge variant="info" className="max-w-full gap-1.5 whitespace-normal text-left">
      <Clock3 className="size-3 shrink-0" aria-hidden="true" />
      <span>
        Core comercial lido em <time dateTime={commerce.sourceFreshness.generatedAt} className="font-mono tabular-nums">{formatTimestamp(commerce.sourceFreshness.generatedAt)}</time>
      </span>
    </StatusBadge>
  );
}

function CommerceMetrics({ record }: { record: CommerceReadbackRecord }) {
  const values = [
    { label: "Produtos mapeados", value: `${record.metrics.mapped_product_count}/${record.metrics.catalog_product_count}` },
    { label: "Vendas", value: record.metrics.sale_count },
    { label: "Acessos ativos", value: record.metrics.active_access_count },
    { label: "Readbacks", value: record.metrics.readback_count },
    { label: "Quarentenas", value: record.metrics.quarantine_count },
  ];
  return (
    <dl className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 xl:grid-cols-5">
      {values.map((item) => (
        <div key={item.label} className="bg-card px-3 py-2.5">
          <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-mono text-xs font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PublicationSummary({ projection, lifecycle }: {
  projection: Extract<OperationPublicationProjection, { kind: "ready" }>;
  lifecycle: OperationLifecycleEvidenceProjection;
}) {
  const attention = lifecycle.counts.FAIL + lifecycle.counts.STALE + lifecycle.counts.DIVERGENT;
  const values = [
    { label: "Ofertas acompanhadas", value: projection.counts.offers, icon: Globe2 },
    { label: "Registradas localmente", value: projection.counts.registered, icon: MapPinCheck },
    { label: "Lifecycle PASS", value: lifecycle.counts.PASS, icon: CheckCircle2 },
    { label: "Atenção", value: attention, icon: AlertTriangle },
  ];
  return (
    <section aria-label="Resumo de publicação e lifecycle" aria-live="polite">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {values.map((item, index) => (
            <div key={item.label} className={`flex min-h-24 items-center gap-3 px-4 py-4 sm:px-6 ${index % 2 === 1 ? "border-l" : ""} ${index >= 2 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
              <item.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums leading-none sm:text-3xl">{item.value}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
        PENDING significa que ainda faltam provas independentes. REGISTERED é somente registro local e não confirma deploy, disponibilidade pública, checkout, tracking ou produção.
      </p>
    </section>
  );
}

function PublicationCards({ records, lifecycleByOfferId, commerceByOfferId }: {
  records: PublicationRecord[];
  lifecycleByOfferId: Map<number, LifecycleEvidenceRecord>;
  commerceByOfferId: Map<number, CommerceReadbackRecord>;
}) {
  return (
    <ul className="space-y-3 md:hidden" aria-label="Registros de publicação">
      {records.map((record) => {
        const lifecycle = lifecycleByOfferId.get(record.offerTrackingId) ?? pendingLifecycleRecord(record);
        const commerce = commerceByOfferId.get(record.offerTrackingId) ?? pendingCommerceRecord(record);
        return (
          <li key={record.offerTrackingId} className="rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <OfferReference record={record} />
              <LocalRegistrationBadge state={record.localRegistrationState} />
            </div>
            <dl className="mt-4 grid gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Endereços registrados</dt>
                <dd className="mt-1">{record.registeredTargets.length ? record.registeredTargets.map((target) => TARGET_LABELS[target] ?? target).join(" · ") : "Nenhum"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lifecycle</dt>
                <dd className="mt-1"><LifecycleStateBadge state={lifecycle.state} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Comércio</dt>
                <dd className="mt-1"><CommerceStateBadge state={commerce.state} /></dd>
              </div>
            </dl>
            <LifecycleFacetDetails record={lifecycle} />
            <div className="mt-3"><CommerceMetrics record={commerce} /></div>
            <p className="mt-3 font-mono text-[11px] tabular-nums text-muted-foreground">Atualização local · {formatTimestamp(record.updatedAt)}</p>
          </li>
        );
      })}
    </ul>
  );
}

function PublicationTable({ records, lifecycleByOfferId, commerceByOfferId }: {
  records: PublicationRecord[];
  lifecycleByOfferId: Map<number, LifecycleEvidenceRecord>;
  commerceByOfferId: Map<number, CommerceReadbackRecord>;
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="h-10 px-3 font-medium">Oferta</th>
            <th scope="col" className="h-10 px-3 font-medium">Registro local</th>
            <th scope="col" className="h-10 px-3 font-medium">Endereços registrados</th>
            <th scope="col" className="h-10 px-3 font-medium">Lifecycle</th>
            <th scope="col" className="h-10 px-3 font-medium">Provas</th>
            <th scope="col" className="h-10 px-3 font-medium">Comércio</th>
            <th scope="col" className="h-10 px-3 font-medium">Métricas comerciais</th>
            <th scope="col" className="h-10 px-3 font-medium">Atualização local</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const lifecycle = lifecycleByOfferId.get(record.offerTrackingId) ?? pendingLifecycleRecord(record);
            const commerce = commerceByOfferId.get(record.offerTrackingId) ?? pendingCommerceRecord(record);
            return (
              <tr key={record.offerTrackingId} className="border-b align-top last:border-0 even:bg-muted/20">
                <td className="min-h-12 px-3 py-3"><OfferReference record={record} /></td>
                <td className="min-h-12 px-3 py-3"><LocalRegistrationBadge state={record.localRegistrationState} /></td>
                <td className="min-h-12 px-3 py-3 text-xs">{record.registeredTargets.length ? record.registeredTargets.map((target) => TARGET_LABELS[target] ?? target).join(" · ") : "Nenhum"}</td>
                <td className="min-h-12 px-3 py-3"><LifecycleStateBadge state={lifecycle.state} /></td>
                <td className="min-h-12 px-3 py-3"><LifecycleFacetDetails record={lifecycle} /></td>
                <td className="min-h-12 px-3 py-3"><CommerceStateBadge state={commerce.state} /></td>
                <td className="min-h-12 px-3 py-3"><CommerceMetrics record={commerce} /></td>
                <td className="min-h-12 px-3 py-3 font-mono text-xs tabular-nums">{formatTimestamp(record.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OperationPublicationView({ projection, lifecycle, commerce }: {
  projection: OperationPublicationProjection;
  lifecycle: OperationLifecycleEvidenceProjection;
  commerce: OperationCommerceReadbackProjection;
}) {
  const definition = TRANSVERSAL_OPERATION_MODULE_DIRECTORY.publicacao;
  const lifecycleByOfferId = new Map(lifecycle.records.map((record) => [record.offerTrackingId, record]));
  const commerceByOfferId = new Map(commerce.records.map((record) => [record.offerTrackingId, record]));

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="h-11 gap-1.5 px-3 text-sm text-muted-foreground md:h-9" render={<Link href="/operacao" />}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Visão geral
      </Button>
      <PageHeader title={definition.title} description={definition.description} />

      {projection.kind === "migration_unverified" ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Estrutura local não verificada</h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">Os campos de identificação ou registro de endereço ainda não foram confirmados no banco conectado. Nenhum deploy é inferido por esta tela.</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Fonte esperada: {projection.source}</p>
            </div>
          </div>
        </section>
      ) : projection.kind === "unavailable" ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Leitura local indisponível</h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">Não foi possível consultar os registros nesta leitura. A falha não confirma nem invalida publicação externa.</p>
            </div>
          </div>
        </section>
      ) : projection.kind === "ready" ? (
        <>
          <PublicationSummary projection={projection} lifecycle={lifecycle} />
          <section aria-labelledby="publication-records" className="rounded-lg border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-primary">Registro local e lifecycle</p>
                <h2 id="publication-records" className="mt-1 text-xl font-semibold tracking-tight">Evidências por oferta</h2>
                <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">REGISTERED só confirma que existe um endereço em <span className="font-mono">offer_tracking.site_urls</span>. A prova de deploy, URL pública, checkout, tracking e produção é independente e nunca é inferida pelo registro local.</p>
              </div>
              <StatusBadge variant="neutral" className="gap-1.5">
                <Clock3 className="size-3" aria-hidden="true" />
                {freshnessLabel(projection.observedAt)}
              </StatusBadge>
            </div>
            <div className="mt-5"><LifecycleAvailability lifecycle={lifecycle} /></div>
            <div className="mt-3"><CommerceAvailability commerce={commerce} /></div>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
              <div className="bg-card p-3"><dt className="text-[11px] text-muted-foreground">Fonte local</dt><dd className="mt-1 font-mono text-xs tabular-nums">{projection.source}</dd></div>
              <div className="bg-card p-3"><dt className="text-[11px] text-muted-foreground">Fonte de lifecycle</dt><dd className="mt-1 font-mono text-xs tabular-nums">{lifecycle.source}</dd></div>
              <div className="bg-card p-3"><dt className="text-[11px] text-muted-foreground">Última atualização local</dt><dd className="mt-1 font-mono text-xs tabular-nums">{formatTimestamp(projection.observedAt)}</dd></div>
            </dl>
            {projection.records.length === 0 ? (
              <EmptyState icon={Globe2} title="Nenhuma oferta registrada" description="A ausência de registros não comprova que não existam domínios ou páginas fora desta fonte local." className="py-10" />
            ) : (
              <div className="mt-5">
                <PublicationCards records={projection.records} lifecycleByOfferId={lifecycleByOfferId} commerceByOfferId={commerceByOfferId} />
                <PublicationTable records={projection.records} lifecycleByOfferId={lifecycleByOfferId} commerceByOfferId={commerceByOfferId} />
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
