"use server";

import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const teamMemberSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.email("Email inválido"),
  role: z.enum(["admin", "copywriter", "editor", "gestor_trafego"]),
  active: z.boolean().default(true),
});

export type TeamMemberFormData = z.infer<typeof teamMemberSchema>;

export async function getTeamMembers() {
  return db.select().from(teamMembers).orderBy(teamMembers.name);
}

export async function createTeamMember(data: TeamMemberFormData) {
  const parsed = teamMemberSchema.parse(data);
  await db.insert(teamMembers).values(parsed);
  revalidatePath("/team");
}

export async function updateTeamMember(id: number, data: TeamMemberFormData) {
  const parsed = teamMemberSchema.parse(data);
  await db
    .update(teamMembers)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(teamMembers.id, id));
  revalidatePath("/team");
}

export async function deleteTeamMember(id: number) {
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
  revalidatePath("/team");
}
