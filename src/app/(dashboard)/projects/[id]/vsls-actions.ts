"use server";

import { db } from "@/db";
import { vsls, teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const vslSchema = z.object({
  projectId: z.number(),
  version: z.string().min(1, "Versão é obrigatória"),
  copywriterId: z.number().nullable(),
  btubeLink: z.string().nullable(),
  duration: z.number().nullable(),
  priceRevealSecond: z.number().nullable(),
  buttonAppearSecond: z.number().nullable(),
  backRedirectActive: z.boolean(),
  status: z.string().default("ativo"),
});

export type VslFormData = z.infer<typeof vslSchema>;

export async function getVsls(projectId: number) {
  return db
    .select({
      id: vsls.id,
      version: vsls.version,
      copywriterId: vsls.copywriterId,
      copywriterName: teamMembers.name,
      btubeLink: vsls.btubeLink,
      duration: vsls.duration,
      priceRevealSecond: vsls.priceRevealSecond,
      buttonAppearSecond: vsls.buttonAppearSecond,
      backRedirectActive: vsls.backRedirectActive,
      status: vsls.status,
      projectId: vsls.projectId,
      createdAt: vsls.createdAt,
    })
    .from(vsls)
    .leftJoin(teamMembers, eq(vsls.copywriterId, teamMembers.id))
    .where(eq(vsls.projectId, projectId))
    .orderBy(vsls.createdAt);
}

export async function createVsl(data: VslFormData) {
  const parsed = vslSchema.parse(data);
  await db.insert(vsls).values(parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function updateVsl(id: number, data: VslFormData) {
  const parsed = vslSchema.parse(data);
  await db
    .update(vsls)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(vsls.id, id));
  revalidatePath(`/projects/${data.projectId}`);
}

export async function deleteVsl(id: number, projectId: number) {
  await db.delete(vsls).where(eq(vsls.id, id));
  revalidatePath(`/projects/${projectId}`);
}
