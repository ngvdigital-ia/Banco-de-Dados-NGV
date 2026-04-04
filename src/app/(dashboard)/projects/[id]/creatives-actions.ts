"use server";

import { db } from "@/db";
import { creatives, teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logChange } from "@/lib/changelog";

const creativeSchema = z.object({
  projectId: z.number(),
  platform: z.enum(["meta", "tiktok", "google", "kwai"]),
  format: z.enum(["especialista", "ugc_masc", "ugc_fem", "famoso", "youtuber", "autoridade", "podcast"]),
  copyScript: z.string().nullable(),
  copywriterId: z.number().nullable(),
  editorId: z.number().nullable(),
  videoLink: z.string().nullable(),
  status: z.enum(["rascunho", "testando", "validado", "escalando", "publicado", "pausado"]),
});

export type CreativeFormData = z.infer<typeof creativeSchema>;

export async function getCreatives(projectId: number) {
  const copywriter = db.$with("copywriter").as(
    db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers)
  );

  return db
    .select({
      id: creatives.id,
      projectId: creatives.projectId,
      platform: creatives.platform,
      format: creatives.format,
      copyScript: creatives.copyScript,
      copywriterId: creatives.copywriterId,
      editorId: creatives.editorId,
      videoLink: creatives.videoLink,
      status: creatives.status,
      publishDate: creatives.publishDate,
      createdAt: creatives.createdAt,
    })
    .from(creatives)
    .where(eq(creatives.projectId, projectId))
    .orderBy(creatives.createdAt);
}

export async function createCreative(data: CreativeFormData) {
  const parsed = creativeSchema.parse(data);
  const [result] = await db.insert(creatives).values(parsed).returning({ id: creatives.id });
  await logChange("creative", result.id, "create", parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function updateCreative(id: number, data: CreativeFormData) {
  const parsed = creativeSchema.parse(data);
  await db.update(creatives).set({ ...parsed, updatedAt: new Date() }).where(eq(creatives.id, id));
  await logChange("creative", id, "update", parsed);
  revalidatePath(`/projects/${data.projectId}`);
}

export async function deleteCreative(id: number, projectId: number) {
  await db.delete(creatives).where(eq(creatives.id, id));
  await logChange("creative", id, "delete");
  revalidatePath(`/projects/${projectId}`);
}
