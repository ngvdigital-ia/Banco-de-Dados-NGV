import { db } from "@/db";
import { changeLog } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";

export async function logChange(
  entityType: string,
  entityId: number,
  action: "create" | "update" | "delete",
  changes?: Record<string, unknown>
) {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session.userId;
  } catch {
    // Server action sem contexto de auth
  }

  await db.insert(changeLog).values({
    entityType,
    entityId,
    action,
    changesJson: changes ?? null,
    userId,
  });
}
