"use server";

import { db } from "@/db";
import { funnels, funnelNodes, orderBumps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logChange } from "@/lib/changelog";

const funnelSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1, "Nome é obrigatório"),
  salesPageUrl: z.string().nullable(),
  checkoutUrl: z.string().nullable(),
});

export type FunnelFormData = z.infer<typeof funnelSchema>;

const funnelNodeSchema = z.object({
  funnelId: z.number(),
  parentNodeId: z.number().nullable(),
  nodeType: z.enum(["checkout", "upsell", "downsell"]),
  offerName: z.string().min(1),
  price: z.string(),
  url: z.string().nullable(),
  acceptDestinationId: z.number().nullable(),
  declineDestinationId: z.number().nullable(),
  position: z.number().default(0),
});

export type FunnelNodeFormData = z.infer<typeof funnelNodeSchema>;

const orderBumpSchema = z.object({
  funnelId: z.number(),
  name: z.string().min(1),
  price: z.string(),
  active: z.boolean().default(true),
});

export type OrderBumpFormData = z.infer<typeof orderBumpSchema>;

export async function getFunnels(projectId: number) {
  return db.select().from(funnels).where(eq(funnels.projectId, projectId)).orderBy(funnels.createdAt);
}

export async function getFunnelNodes(funnelId: number) {
  return db.select().from(funnelNodes).where(eq(funnelNodes.funnelId, funnelId)).orderBy(funnelNodes.position);
}

export async function getOrderBumps(funnelId: number) {
  return db.select().from(orderBumps).where(eq(orderBumps.funnelId, funnelId));
}

export async function createFunnel(data: FunnelFormData) {
  const parsed = funnelSchema.parse(data);
  const [result] = await db.insert(funnels).values(parsed).returning({ id: funnels.id });
  await logChange("funnel", result.id, "create", parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function updateFunnel(id: number, data: FunnelFormData) {
  const parsed = funnelSchema.parse(data);
  await db.update(funnels).set({ ...parsed, updatedAt: new Date() }).where(eq(funnels.id, id));
  revalidatePath(`/projects/${data.projectId}`);
}

export async function deleteFunnel(id: number, projectId: number) {
  await db.delete(funnelNodes).where(eq(funnelNodes.funnelId, id));
  await db.delete(orderBumps).where(eq(orderBumps.funnelId, id));
  await db.delete(funnels).where(eq(funnels.id, id));
  await logChange("funnel", id, "delete");
  revalidatePath(`/projects/${projectId}`);
}

export async function createFunnelNode(data: FunnelNodeFormData) {
  const parsed = funnelNodeSchema.parse(data);
  await db.insert(funnelNodes).values(parsed);
}

export async function deleteFunnelNode(id: number) {
  await db.delete(funnelNodes).where(eq(funnelNodes.id, id));
}

export async function createOrderBump(data: OrderBumpFormData) {
  const parsed = orderBumpSchema.parse(data);
  await db.insert(orderBumps).values(parsed);
}

export async function deleteOrderBump(id: number) {
  await db.delete(orderBumps).where(eq(orderBumps.id, id));
}
