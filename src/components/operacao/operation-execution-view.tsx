import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ListChecks,
  LoaderCircle,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  type ExecutionReceipt,
  type OperationExecutionProjection,
} from "@/lib/operacao/execution-module";
import { TRANSVERSAL_OPERATION_MODULE_DIRECTORY } from "@/lib/operacao/system-directory";

const STATE_META = {
  queued: {
    label: "Enfileirada",
    variant: "info" as const,
    icon: CircleDashed,
  },
  leased: { label: "Assumida", variant: "info" as const, icon: LoaderCircle },
  running: {
    label: "Em execução",
    variant: "info" as const,
    icon: LoaderCircle,
  },
  ready_for_review: {
    label: "Para revisão",
    variant: "warning" as const,
    icon: AlertTriangle,
  },
  waiting_human: {
    label: "Aguardando revisão",
    variant: "warning" as const,
    icon: AlertTriangle,
  },
  failed: { label: "Falhou", variant: "danger" as const, icon: AlertTriangle },
  completed: {
    label: "Evidência recebida",
    variant: "success" as const,
    icon: CheckCircle2,
  },
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
  if (!value) return "Sem recibos locais";
  const ageHours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).valueOf()) / 3_600_000),
  );
  return `${ageHours} h desde a última leitura local`;
}

function StateBadge({ state }: { state: ExecutionReceipt["outboxState"] }) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <StatusBadge variant={meta.variant} className="gap-1.5">
      <Icon className="size-3" aria-hidden="true" />
      {meta.label}
    </StatusBadge>
  );
}

function ExecutionSummary({
  projection,
}: {
  projection: Extract<OperationExecutionProjection, { kind: "ready" }>;
}) {
  const values = [
    {
      label: "Recibos locais",
      value: Object.values(projection.counts).reduce(
        (total, count) => total + count,
        0,
      ),
      icon: ListChecks,
    },
    {
      label: "Em execução",
      value: projection.counts.leased + projection.counts.running,
      icon: LoaderCircle,
    },
    {
      label: "Para revisão",
      value:
        projection.counts.ready_for_review + projection.counts.waiting_human,
      icon: AlertTriangle,
    },
    { label: "Falhas", value: projection.counts.failed, icon: AlertTriangle },
  ];

  return (
    <section
      aria-label="Resumo de execução"
      aria-live="polite"
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {values.map((item, index) => (
          <div
            key={item.label}
            className={`flex min-h-24 items-center gap-3 px-4 py-4 sm:px-6 ${index % 2 === 1 ? "border-l" : ""} ${index >= 2 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}
          >
            <item.icon
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums leading-none sm:text-3xl">
                {item.value}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReceiptCards({ receipts }: { receipts: ExecutionReceipt[] }) {
  return (
    <ul className="space-y-3 md:hidden" aria-label="Recibos locais">
      {receipts.map((receipt, index) => (
        <li
          key={`${receipt.offerId}-${receipt.targetKey}-${receipt.lastReadAt}-${index}`}
          className="rounded-md border p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-medium tabular-nums">
                {receipt.offerId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {receipt.kind} · {receipt.targetKey}
              </p>
            </div>
            <StateBadge state={receipt.outboxState} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Tentativas</dt>
              <dd className="mt-1 font-mono tabular-nums">
                {receipt.attempts}/{receipt.maxAttempts}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Última leitura</dt>
              <dd className="mt-1 font-mono tabular-nums">
                {formatTimestamp(receipt.lastReadAt)}
              </dd>
            </div>
            {receipt.failureCode && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Código sanitizado</dt>
                <dd className="mt-1 font-mono tabular-nums">
                  {receipt.failureCode}
                </dd>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ReceiptTable({ receipts }: { receipts: ExecutionReceipt[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="h-10 px-3 font-medium">
              Oferta
            </th>
            <th scope="col" className="h-10 px-3 font-medium">
              Tipo
            </th>
            <th scope="col" className="h-10 px-3 font-medium">
              Estado local
            </th>
            <th scope="col" className="h-10 px-3 font-medium">
              Tentativas
            </th>
            <th scope="col" className="h-10 px-3 font-medium">
              Última leitura
            </th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt, index) => (
            <tr
              key={`${receipt.offerId}-${receipt.targetKey}-${receipt.lastReadAt}-${index}`}
              className="border-b last:border-0 even:bg-muted/20"
            >
              <td className="h-12 px-3 font-mono text-xs tabular-nums">
                {receipt.offerId}
              </td>
              <td className="h-12 px-3 text-xs">
                {receipt.kind} ·{" "}
                <span className="font-mono tabular-nums">
                  {receipt.targetKey}
                </span>
              </td>
              <td className="h-12 px-3">
                <StateBadge state={receipt.outboxState} />
              </td>
              <td className="h-12 px-3 font-mono text-xs tabular-nums">
                {receipt.attempts}/{receipt.maxAttempts}
              </td>
              <td className="h-12 px-3 font-mono text-xs tabular-nums">
                {formatTimestamp(receipt.lastReadAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperationExecutionView({
  projection,
}: {
  projection: OperationExecutionProjection;
}) {
  const definition = TRANSVERSAL_OPERATION_MODULE_DIRECTORY.execucao;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        className="h-11 gap-1.5 px-3 text-sm text-muted-foreground md:h-9"
        render={<Link href="/operacao" />}
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Visão geral
      </Button>
      <PageHeader
        title={definition.title}
        description={definition.description}
      />

      {projection.kind === "migration_unverified" ? (
        <section
          className="rounded-lg border border-warning/40 bg-warning/5 p-5"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 size-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Migração externa não verificada</h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                A estrutura local de recibos ainda não foi confirmada no banco
                conectado. Nenhuma execução é inferida por esta tela.
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Fonte esperada: {projection.source}
              </p>
            </div>
          </div>
        </section>
      ) : projection.kind === "unavailable" ? (
        <section
          className="rounded-lg border border-warning/40 bg-warning/5 p-5"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 size-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Leitura local indisponível</h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                Não foi possível consultar os recibos nesta leitura. A falha não
                altera o estado de nenhuma execução.
              </p>
            </div>
          </div>
        </section>
      ) : projection.kind === "ready" ? (
        <>
          <ExecutionSummary projection={projection} />
          <section
            aria-labelledby="execution-receipts"
            className="rounded-lg border bg-card p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
                  Leitura local
                </p>
                <h2
                  id="execution-receipts"
                  className="mt-1 text-xl font-semibold tracking-tight"
                >
                  Recibos de execução
                </h2>
                <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                  O Banco exibe somente estado, tentativas e evidências
                  sanitizadas já recebidas. Não envia ordens nem consulta o
                  runner nesta tela.
                </p>
              </div>
              <StatusBadge variant="neutral" className="gap-1.5">
                <Clock3 className="size-3" aria-hidden="true" />
                {freshnessLabel(projection.observedAt)}
              </StatusBadge>
            </div>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
              <div className="bg-card p-3">
                <dt className="text-[11px] text-muted-foreground">Fonte</dt>
                <dd className="mt-1 font-mono text-xs tabular-nums">
                  {projection.source}
                </dd>
              </div>
              <div className="bg-card p-3">
                <dt className="text-[11px] text-muted-foreground">
                  Execução externa
                </dt>
                <dd className="mt-1">
                  <StatusBadge variant="neutral">Não verificada</StatusBadge>
                </dd>
              </div>
              <div className="bg-card p-3">
                <dt className="text-[11px] text-muted-foreground">
                  Última leitura
                </dt>
                <dd className="mt-1 font-mono text-xs tabular-nums">
                  {formatTimestamp(projection.observedAt)}
                </dd>
              </div>
            </dl>
            {projection.receipts.length === 0 ? (
              <EmptyState
                icon={Workflow}
                title="Nenhum recibo local"
                description="Ainda não há recibos sanitizados registrados. Isso não comprova que uma execução externa esteja parada ou concluída."
                className="py-10"
              />
            ) : (
              <div className="mt-5">
                <ReceiptCards receipts={projection.receipts} />
                <ReceiptTable receipts={projection.receipts} />
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
