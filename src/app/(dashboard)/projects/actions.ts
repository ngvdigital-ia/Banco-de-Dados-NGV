"use server";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logChange } from "@/lib/changelog";

const projectSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  niche: z.string().min(1, "Nicho é obrigatório"),
  targetMarket: z.string().min(1, "Mercado é obrigatório"),
  language: z.string().min(1, "Idioma é obrigatório"),
  status: z.enum(["em_teste", "rodando", "pausado"]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export async function getProjects(filters?: {
  niche?: string;
  language?: string;
  status?: string;
}) {
  const conditions: SQL[] = [];

  if (filters?.niche) {
    conditions.push(eq(projects.niche, filters.niche));
  }
  if (filters?.language) {
    conditions.push(eq(projects.language, filters.language));
  }
  if (filters?.status) {
    conditions.push(eq(projects.status, filters.status as "em_teste" | "rodando" | "pausado"));
  }

  const query = db.select().from(projects);

  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(projects.createdAt);
  }

  return query.orderBy(projects.createdAt);
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
  const [result] = await db.insert(projects).values(parsed).returning({ id: projects.id });
  await logChange("project", result.id, "create", parsed);
  revalidatePath("/projects");
}

export async function updateProject(id: number, data: ProjectFormData) {
  const parsed = projectSchema.parse(data);
  await db
    .update(projects)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(projects.id, id));
  await logChange("project", id, "update", parsed);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: number) {
  await db.delete(projects).where(eq(projects.id, id));
  await logChange("project", id, "delete");
  revalidatePath("/projects");
}
