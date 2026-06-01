"use server";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logChange } from "@/lib/changelog";
import { requireAdmin } from "@/lib/admin-auth";

const projectSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["vsl", "tsl"]),
  niche: z.string().min(1, "Nicho é obrigatório"),
  language: z.string().min(1, "Idioma é obrigatório"),
  status: z.enum(["escalou", "nao_escalou", "em_teste", "rodando", "pausado"]),
  scaleStartDate: z.string().nullable().optional(),
  scaleEndDate: z.string().nullable().optional(),
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
    conditions.push(eq(projects.status, filters.status as "escalou" | "nao_escalou" | "em_teste" | "rodando" | "pausado"));
  }

  const query = db.select().from(projects);

  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(projects.createdAt).limit(500);
  }

  return query.orderBy(projects.createdAt).limit(500);
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
  await requireAdmin();

  const parsed = projectSchema.parse(data);
  const { scaleStartDate, scaleEndDate, ...rest } = parsed;
  const values = {
    ...rest,
    scaleStartDate: scaleStartDate ? new Date(scaleStartDate) : null,
    scaleEndDate: scaleEndDate ? new Date(scaleEndDate) : null,
  };
  const [result] = await db.insert(projects).values(values).returning({ id: projects.id });
  await logChange("project", result.id, "create", values);
  revalidatePath("/projects");
}

export async function updateProject(id: number, data: ProjectFormData) {
  await requireAdmin();

  const parsed = projectSchema.parse(data);
  const { scaleStartDate, scaleEndDate, ...rest } = parsed;
  const values = {
    ...rest,
    scaleStartDate: scaleStartDate ? new Date(scaleStartDate) : null,
    scaleEndDate: scaleEndDate ? new Date(scaleEndDate) : null,
    updatedAt: new Date(),
  };
  await db
    .update(projects)
    .set(values)
    .where(eq(projects.id, id));
  await logChange("project", id, "update", values);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: number) {
  await requireAdmin();

  await db.delete(projects).where(eq(projects.id, id));
  await logChange("project", id, "delete");
  revalidatePath("/projects");
}
