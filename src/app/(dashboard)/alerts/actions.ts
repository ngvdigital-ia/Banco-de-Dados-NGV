"use server";

import { db } from "@/db";
import { alerts, alertHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAlerts() {
  return db.select().from(alerts).orderBy(desc(alerts.createdAt));
}

export async function createAlert(data: {
  name: string;
  entityType: string;
  metric: string;
  operator: "gt" | "lt" | "eq";
  threshold: string;
}) {
  await db.insert(alerts).values(data);
  revalidatePath("/alerts");
}

export async function toggleAlert(id: number, active: boolean) {
  await db.update(alerts).set({ active }).where(eq(alerts.id, id));
  revalidatePath("/alerts");
}

export async function deleteAlert(id: number) {
  await db.delete(alertHistory).where(eq(alertHistory.alertId, id));
  await db.delete(alerts).where(eq(alerts.id, id));
  revalidatePath("/alerts");
}

export async function getAlertHistory(alertId: number) {
  return db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.alertId, alertId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(10);
}
