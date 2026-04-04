"use server";

import { db } from "@/db";
import { campaigns, teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logChange } from "@/lib/changelog";

const campaignSchema = z.object({
  projectId: z.number(),
  platform: z.enum(["meta", "tiktok", "google", "kwai"]),
  name: z.string().min(1, "Nome é obrigatório"),
  objective: z.string().nullable(),
  dailyBudget: z.string().nullable(),
  managerId: z.number().nullable(),
  status: z.string().default("ativo"),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

export async function getCampaigns(projectId: number) {
  return db
    .select({
      id: campaigns.id,
      projectId: campaigns.projectId,
      platform: campaigns.platform,
      name: campaigns.name,
      objective: campaigns.objective,
      dailyBudget: campaigns.dailyBudget,
      managerId: campaigns.managerId,
      managerName: teamMembers.name,
      status: campaigns.status,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .leftJoin(teamMembers, eq(campaigns.managerId, teamMembers.id))
    .where(eq(campaigns.projectId, projectId))
    .orderBy(campaigns.createdAt);
}

export async function createCampaign(data: CampaignFormData) {
  const parsed = campaignSchema.parse(data);
  const [result] = await db.insert(campaigns).values(parsed).returning({ id: campaigns.id });
  await logChange("campaign", result.id, "create", parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function updateCampaign(id: number, data: CampaignFormData) {
  const parsed = campaignSchema.parse(data);
  await db.update(campaigns).set({ ...parsed, updatedAt: new Date() }).where(eq(campaigns.id, id));
  await logChange("campaign", id, "update", parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function deleteCampaign(id: number, projectId: number) {
  await db.delete(campaigns).where(eq(campaigns.id, id));
  await logChange("campaign", id, "delete");
  revalidatePath(`/projects/${projectId}`);
}
