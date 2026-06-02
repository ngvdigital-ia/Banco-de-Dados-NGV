/**
 * Avaliação server-side do Motor de Alertas — calcula o valor atual de uma métrica
 * pra um alvo e decide se o alerta dispara. Usado pelas Server Actions (preview) e
 * pelo cron /api/cron/check-alerts.
 */

import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { DASHBOARDS } from "@/lib/utmify";
import { and, eq, sql } from "drizzle-orm";
import type { AlertMetric, AlertOperator } from "@/lib/alerts-config";

export interface MetricResult {
  value: number | null;
  currency: string;
  asOf: Date | null; // dia do dado usado
}

/**
 * Valor atual de uma métrica pra um alvo.
 * - dashboard: agrega `utmify_campaign_daily` daquele dashboard no dia mais recente.
 * - global: refund_rate das vendas reais (`entity_type='sale'`).
 */
export async function computeMetricValue(
  metric: AlertMetric,
  entityType: string,
  entityId: number | null,
): Promise<MetricResult> {
  if (entityType === "global") return computeGlobalMetric(metric);

  const dash = entityId != null ? DASHBOARDS[entityId] : undefined;
  if (!dash) return { value: null, currency: "USD", asOf: null };
  return computeDashboardMetric(metric, dash.id, dash.currency);
}

async function computeDashboardMetric(
  metric: AlertMetric,
  dashboardId: string,
  currency: string,
): Promise<MetricResult> {
  if (metric === "refund_rate") return { value: null, currency, asOf: null };

  // Soma dos últimos 7 dias sincronizados daquele dashboard (suaviza ruído de 1 dia parcial).
  const rows = await db
    .select({
      spend: sql<string>`coalesce(sum(${metricsSnapshots.spend}), 0)`,
      revenue: sql<string>`coalesce(sum(${metricsSnapshots.revenue}), 0)`,
      asOf: sql<string>`max(${metricsSnapshots.date})`,
    })
    .from(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.entityType, "utmify_campaign_daily"),
        sql`${metricsSnapshots.extraData}->>'dashboardId' = ${dashboardId}`,
        sql`${metricsSnapshots.date} >= (
          select max(date) from metrics_snapshots
          where entity_type = 'utmify_campaign_daily'
            and extra_data->>'dashboardId' = ${dashboardId}
        ) - interval '6 days'`,
      ),
    );

  const r = rows[0];
  if (!r || r.asOf == null) return { value: null, currency, asOf: null };
  const spend = Number(r.spend);
  const revenue = Number(r.revenue);
  const asOf = new Date(r.asOf);

  let value: number | null = null;
  if (metric === "spend") value = spend;
  else if (metric === "revenue") value = revenue;
  else if (metric === "roas") value = spend > 0 ? revenue / spend : null;

  return { value, currency, asOf };
}

async function computeGlobalMetric(metric: AlertMetric): Promise<MetricResult> {
  // Global só faz sentido pra refund_rate (vendas reais, em USD). Demais não se aplicam.
  if (metric !== "refund_rate") return { value: null, currency: "USD", asOf: null };

  const rows = await db
    .select({
      approved: sql<string>`count(*) filter (where ${metricsSnapshots.extraData}->>'status' = 'approved')`,
      refunded: sql<string>`count(*) filter (where ${metricsSnapshots.extraData}->>'status' in ('refunded','charged_back'))`,
      asOf: sql<string>`max(${metricsSnapshots.date})`,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "sale"));

  const r = rows[0];
  const approved = Number(r?.approved ?? 0);
  const refunded = Number(r?.refunded ?? 0);
  const denom = approved + refunded;
  const value = denom > 0 ? (refunded / denom) * 100 : null;
  return { value, currency: "USD", asOf: r?.asOf ? new Date(r.asOf) : null };
}

/** O alerta dispara? compara `value` com `threshold` via `operator`. NULL nunca dispara. */
export function alertTriggers(value: number | null, operator: AlertOperator | string, threshold: number): boolean {
  if (value == null) return false;
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "eq":
      return value === threshold;
    default:
      return false;
  }
}
