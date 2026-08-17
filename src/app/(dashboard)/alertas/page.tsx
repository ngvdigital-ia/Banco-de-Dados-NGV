import { AlertTriangle, BellRing, Pause, Play, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AlertFormDialog } from "@/components/alerts/alert-form-dialog";
import { AlertsEmptyState } from "@/components/alerts/alerts-empty-state";
import {
  getAlertsWithStatus,
  getRecentAlertHistory,
  toggleAlert,
  deleteAlert,
} from "./actions";
import {
  alertMetricDef,
  alertTargetByEntity,
  operatorSymbol,
  formatMetricValue,
} from "@/lib/alerts-config";
import { computeDataFreshness } from "@/lib/alerts-freshness.mjs";

// Mostra o valor atual das métricas (muda a cada sync) — nunca prerenderizar estático.
export const dynamic = "force-dynamic";

function fmt(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fmtDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default async function AlertasPage() {
  const [rows, history] = await Promise.all([
    getAlertsWithStatus(),
    getRecentAlertHistory(30),
  ]);
  // Uma referência de "agora" só, reusada em toda a tabela — evita cada linha calcular
  // um "hoje" ligeiramente diferente durante o mesmo render.
  const now = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alertas"
        description="Monitora ROAS, gasto e reembolso e avisa no Slack quando passa do limite. Avaliado todo dia às 4h30."
      >
        <AlertFormDialog />
      </PageHeader>

      {rows.length === 0 ? (
        <AlertsEmptyState />
      ) : (
        <>
          {/* Tabela de alertas */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Alertas configurados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nome
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Condição
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Alvo
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Valor atual
                    </TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const metricDef = alertMetricDef(r.metric);
                    const fmt_ = metricDef?.format ?? "multiplier";
                    const targetLabel =
                      alertTargetByEntity(r.entityType, r.entityId)?.label ?? "—";

                    const conditionStr = `${metricDef?.label ?? r.metric} ${operatorSymbol(r.operator)} ${formatMetricValue(r.threshold, fmt_, r.currency)}`;
                    const currentStr = formatMetricValue(
                      r.currentValue,
                      fmt_,
                      r.currency
                    );
                    const freshness = computeDataFreshness(r.asOf, now);

                    return (
                      <TableRow
                        key={r.id}
                        className={i % 2 === 1 ? "bg-muted/20" : ""}
                      >
                        {/* Nome */}
                        <TableCell className="pl-4 font-medium text-sm max-w-[180px] truncate">
                          {r.name}
                        </TableCell>

                        {/* Condição */}
                        <TableCell className="tabular-nums font-mono text-xs text-muted-foreground">
                          {conditionStr}
                        </TableCell>

                        {/* Alvo */}
                        <TableCell className="text-sm">{targetLabel}</TableCell>

                        {/* Valor atual */}
                        <TableCell className="tabular-nums text-right text-sm">
                          <span
                            className={
                              r.wouldTrigger ? "text-danger font-semibold" : ""
                            }
                          >
                            {currentStr}
                          </span>
                          {r.asOf && (
                            <span
                              className={
                                "flex items-center justify-end gap-1 text-xs " +
                                (freshness.isStale
                                  ? "text-warning font-medium"
                                  : "text-muted-foreground")
                              }
                              title={
                                freshness.isStale
                                  ? `Dado de ${fmtDate(r.asOf)} — ${freshness.ageDays} dia${freshness.ageDays === 1 ? "" : "s"} sem sincronizar, valor pode não valer mais`
                                  : undefined
                              }
                            >
                              {freshness.isStale && (
                                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                              )}
                              {fmtDate(r.asOf)}
                              {freshness.isStale && ` · ${freshness.ageDays}d atrás`}
                            </span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {!r.active ? (
                            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Pausado
                            </span>
                          ) : r.wouldTrigger ? (
                            <span className="inline-flex items-center rounded-full border border-danger bg-danger-muted px-2 py-0.5 text-xs font-medium text-danger-muted-foreground">
                              Disparando
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-success bg-success-muted px-2 py-0.5 text-xs font-medium text-success-muted-foreground">
                              OK
                            </span>
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Editar */}
                            <AlertFormDialog alert={r} />

                            {/* Pausar / Retomar */}
                            <form action={toggleAlert}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="active"
                                value={String(!r.active)}
                              />
                              <Button
                                type="submit"
                                size="icon"
                                variant="ghost"
                                aria-label={r.active ? "Pausar alerta" : "Retomar alerta"}
                              >
                                {r.active ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            </form>

                            {/* Excluir */}
                            <form action={deleteAlert}>
                              <input type="hidden" name="id" value={r.id} />
                              <Button
                                type="submit"
                                size="icon"
                                variant="ghost"
                                aria-label="Excluir alerta"
                                className="text-muted-foreground hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Histórico de disparos */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Últimos disparos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum disparo ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Quando
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Alerta
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Mensagem
                      </TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Valor
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h, i) => (
                      <TableRow
                        key={h.id}
                        className={i % 2 === 1 ? "bg-muted/20" : ""}
                      >
                        <TableCell className="pl-4 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                          {fmt(h.triggeredAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {h.alertName ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {h.message ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums pr-4 text-right text-sm text-danger">
                          {h.currentValue ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
