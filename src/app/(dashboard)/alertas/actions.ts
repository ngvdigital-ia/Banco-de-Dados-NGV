"use server";

import { db } from "@/db";
import { alerts, alertHistory } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ALERT_METRICS,
  ALERT_OPERATORS,
  alertTargetByValue,
  type AlertMetric,
  type AlertOperator,
} from "@/lib/alerts-config";
import { computeMetricValue, alertTriggers } from "@/lib/alerts-eval";

const metricKeys = ALERT_METRICS.map((m) => m.key) as [string, ...string[]];
const operatorKeys = ALERT_OPERATORS.map((o) => o.key) as [string, ...string[]];

const alertSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  metric: z.enum(metricKeys),
  operator: z.enum(operatorKeys),
  threshold: z.coerce.number().finite("Threshold inválido"),
  target: z.string().min(1),
});

export interface AlertWithStatus {
  id: number;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  entityType: string;
  entityId: number | null;
  active: boolean;
  lastTriggeredAt: Date | null;
  currentValue: number | null;
  currency: string;
  asOf: Date | null;
  wouldTrigger: boolean;
}

/** Lista os alertas + o valor atual de cada métrica + se dispararia agora. */
export async function getAlertsWithStatus(): Promise<AlertWithStatus[]> {
  const rows = await db.select().from(alerts).orderBy(desc(alerts.active), desc(alerts.createdAt));
  const out: AlertWithStatus[] = [];
  for (const a of rows) {
    const res = await computeMetricValue(a.metric as AlertMetric, a.entityType, a.entityId);
    const threshold = Number(a.threshold);
    out.push({
      id: a.id,
      name: a.name,
      metric: a.metric,
      operator: a.operator,
      threshold,
      entityType: a.entityType,
      entityId: a.entityId,
      active: a.active,
      lastTriggeredAt: a.lastTriggeredAt,
      currentValue: res.value,
      currency: res.currency,
      asOf: res.asOf,
      wouldTrigger: a.active && alertTriggers(res.value, a.operator, threshold),
    });
  }
  return out;
}

export interface AlertHistoryRow {
  id: number;
  alertId: number;
  alertName: string | null;
  triggeredAt: Date;
  currentValue: string | null;
  message: string | null;
}

export async function getRecentAlertHistory(limit = 30): Promise<AlertHistoryRow[]> {
  const rows = await db
    .select({
      id: alertHistory.id,
      alertId: alertHistory.alertId,
      alertName: alerts.name,
      triggeredAt: alertHistory.triggeredAt,
      currentValue: alertHistory.currentValue,
      message: alertHistory.message,
    })
    .from(alertHistory)
    .leftJoin(alerts, eq(alertHistory.alertId, alerts.id))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit);
  return rows;
}

export async function createAlert(formData: FormData) {
  const parsed = alertSchema.parse({
    name: formData.get("name"),
    metric: formData.get("metric"),
    operator: formData.get("operator"),
    threshold: formData.get("threshold"),
    target: formData.get("target"),
  });
  const target = alertTargetByValue(parsed.target);
  if (!target) throw new Error(`Alvo inválido: ${parsed.target}`);
  try {
    await db.insert(alerts).values({
      name: parsed.name,
      metric: parsed.metric,
      operator: parsed.operator as AlertOperator,
      threshold: String(parsed.threshold),
      entityType: target.entityType,
      entityId: target.entityId,
    });
    revalidatePath("/alertas");
  } catch (err) {
    console.error("[createAlert]", err);
    throw err;
  }
}

export async function updateAlert(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("id obrigatório");
  const parsed = alertSchema.parse({
    name: formData.get("name"),
    metric: formData.get("metric"),
    operator: formData.get("operator"),
    threshold: formData.get("threshold"),
    target: formData.get("target"),
  });
  const target = alertTargetByValue(parsed.target);
  if (!target) throw new Error(`Alvo inválido: ${parsed.target}`);
  try {
    await db
      .update(alerts)
      .set({
        name: parsed.name,
        metric: parsed.metric,
        operator: parsed.operator as AlertOperator,
        threshold: String(parsed.threshold),
        entityType: target.entityType,
        entityId: target.entityId,
      })
      .where(eq(alerts.id, id));
    revalidatePath("/alertas");
  } catch (err) {
    console.error("[updateAlert]", err);
    throw err;
  }
}

export async function toggleAlert(formData: FormData) {
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id) throw new Error("id obrigatório");
  try {
    await db.update(alerts).set({ active }).where(eq(alerts.id, id));
    revalidatePath("/alertas");
  } catch (err) {
    console.error("[toggleAlert]", err);
    throw err;
  }
}

export async function deleteAlert(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) throw new Error("id obrigatório");
  try {
    await db.delete(alerts).where(eq(alerts.id, id));
    revalidatePath("/alertas");
  } catch (err) {
    console.error("[deleteAlert]", err);
    throw err;
  }
}
