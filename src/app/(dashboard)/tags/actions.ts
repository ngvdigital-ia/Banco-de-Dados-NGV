"use server";

import { db } from "@/db";
import { tags, entityTags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.string().default("custom"),
});

export type TagFormData = z.infer<typeof tagSchema>;

export async function getTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(data: TagFormData) {
  const parsed = tagSchema.parse(data);
  await db.insert(tags).values(parsed);
  revalidatePath("/tags");
}

export async function deleteTag(id: number) {
  await db.delete(entityTags).where(eq(entityTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/tags");
}

export async function getEntityTags(entityType: string, entityId: number) {
  return db
    .select({ id: entityTags.id, tagId: entityTags.tagId, tagName: tags.name, tagType: tags.type })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId)));
}

export async function addTagToEntity(tagId: number, entityType: string, entityId: number) {
  await db.insert(entityTags).values({ tagId, entityType, entityId });
}

export async function removeTagFromEntity(id: number) {
  await db.delete(entityTags).where(eq(entityTags.id, id));
}
