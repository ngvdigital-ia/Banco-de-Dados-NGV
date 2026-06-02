/**
 * Contrato do Motor de Alertas — client-safe (sem imports de db/server).
 * Usado pela UI (/alertas), pelas Server Actions e pelo cron de avaliação.
 *
 * Fonte dos dados (ver alerts-eval.ts):
 *  - roas/spend/revenue: agregados de `utmify_campaign_daily` por dashboard (dia mais recente).
 *  - refund_rate: das vendas reais (`entity_type='sale'`), global.
 */

export type AlertMetric = "roas" | "spend" | "revenue" | "refund_rate";
export type AlertOperator = "gt" | "lt" | "eq";

export interface AlertMetricDef {
  key: AlertMetric;
  label: string;
  format: "multiplier" | "currency" | "percent";
  scope: "dashboard" | "global";
  hint: string;
}

export const ALERT_METRICS: AlertMetricDef[] = [
  { key: "roas", label: "ROAS", format: "multiplier", scope: "dashboard", hint: "Receita ÷ gasto nos últimos 7 dias" },
  { key: "spend", label: "Gasto", format: "currency", scope: "dashboard", hint: "Investido em ads nos últimos 7 dias" },
  { key: "revenue", label: "Receita", format: "currency", scope: "dashboard", hint: "Faturado (UTMify) nos últimos 7 dias" },
  { key: "refund_rate", label: "Taxa de reembolso", format: "percent", scope: "global", hint: "% de pedidos reembolsados (vendas reais)" },
];

export const ALERT_OPERATORS: { key: AlertOperator; label: string; symbol: string }[] = [
  { key: "lt", label: "menor que", symbol: "<" },
  { key: "gt", label: "maior que", symbol: ">" },
  { key: "eq", label: "igual a", symbol: "=" },
];

/**
 * Alvos do v1: cada conta/dashboard (roas/spend/revenue) + o global de vendas (refund_rate).
 * `entityType` guarda 'dashboard'|'global'; `entityId` guarda o índice do dashboard (0/1) ou null.
 */
export interface AlertTargetDef {
  value: string; // chave do <Select> (ex: "dashboard:0")
  entityType: "dashboard" | "global";
  entityId: number | null;
  label: string;
  currency: string;
  scope: "dashboard" | "global";
}

export const ALERT_TARGETS: AlertTargetDef[] = [
  { value: "dashboard:0", entityType: "dashboard", entityId: 0, label: "Conta Principal (BRL)", currency: "BRL", scope: "dashboard" },
  { value: "dashboard:1", entityType: "dashboard", entityId: 1, label: "Conta em Dólar (USD)", currency: "USD", scope: "dashboard" },
  { value: "global", entityType: "global", entityId: null, label: "Vendas globais (USD)", currency: "USD", scope: "global" },
];

export function alertTargetByEntity(entityType: string, entityId: number | null): AlertTargetDef | undefined {
  return ALERT_TARGETS.find((t) => t.entityType === entityType && (t.entityId ?? null) === (entityId ?? null));
}

export function alertTargetByValue(value: string): AlertTargetDef | undefined {
  return ALERT_TARGETS.find((t) => t.value === value);
}

export function alertMetricDef(metric: string): AlertMetricDef | undefined {
  return ALERT_METRICS.find((m) => m.key === metric);
}

export function operatorSymbol(op: string): string {
  return ALERT_OPERATORS.find((o) => o.key === op)?.symbol ?? op;
}

/** Métrica e alvo são compatíveis? (refund_rate só global; demais só dashboard) */
export function isMetricTargetCompatible(metric: string, entityType: string): boolean {
  const m = alertMetricDef(metric);
  if (!m) return false;
  return m.scope === entityType || (m.scope === "dashboard" && entityType === "dashboard");
}

/** Formata um valor de métrica pro display, conforme o tipo. */
export function formatMetricValue(value: number | null | undefined, format: string, currency = "USD"): string {
  if (value == null) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "multiplier":
      return `${value.toFixed(2)}x`;
    default:
      return String(value);
  }
}
