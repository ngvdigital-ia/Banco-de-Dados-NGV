"use server";

import { db } from "@/db";
import { alerts, alertHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const createAlertSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  entityType: z.string().min(1, "Tipo de entidade é obrigatório"),
  metric: z.string().min(1, "Métrica é obrigatória"),
  operator: z.enum(["gt", "lt", "eq"]),
  threshold: z.string().min(1, "Threshold é obrigatório"),
});

const toggleAlertSchema = z.object({
  id: z.number().int().positive(),
  active: z.boolean(),
});

export type CreateAlertData = z.infer<typeof createAlertSchema>;

export async function getAlerts() {
  return db.select().from(alerts).orderBy(desc(alerts.createdAt));
}

export async function createAlert(data: CreateAlertData) {
  const parsed = createAlertSchema.parse(data);
  await db.insert(alerts).values(parsed);
  revalidatePath("/alerts");
}

export async function toggleAlert(id: number, active: boolean) {
  const { id: parsedId, active: parsedActive } = toggleAlertSchema.parse({ id, active });
  await db.update(alerts).set({ active: parsedActive }).where(eq(alerts.id, parsedId));
  revalidatePath("/alerts");
}

export async function deleteAlert(id: number) {
  const parsedId = z.number().int().positive().parse(id);
  await db.delete(alertHistory).where(eq(alertHistory.alertId, parsedId));
  await db.delete(alerts).where(eq(alerts.id, parsedId));
  revalidatePath("/alerts");
}

export async function getAlertHistory(alertId: number) {
  const parsedId = z.number().int().positive().parse(alertId);
  return db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.alertId, parsedId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(10);
}
