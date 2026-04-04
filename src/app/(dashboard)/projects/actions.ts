"use server";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const projectSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  niche: z.string().min(1, "Nicho é obrigatório"),
  targetMarket: z.string().min(1, "Mercado é obrigatório"),
  language: z.string().min(1, "Idioma é obrigatório"),
  status: z.enum(["em_teste", "rodando", "pausado"]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export async function getProjects() {
  return db.select().from(projects).orderBy(projects.createdAt);
}

export async function getProject(id: number) {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createProject(data: ProjectFormData) {
  const parsed = projectSchema.parse(data);
  await db.insert(projects).values(parsed);
  revalidatePath("/projects");
}

export async function updateProject(id: number, data: ProjectFormData) {
  const parsed = projectSchema.parse(data);
  await db
    .update(projects)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(projects.id, id));
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: number) {
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/projects");
}
