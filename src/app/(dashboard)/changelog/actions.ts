"use server";

import { db } from "@/db";
import { changeLog } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getChangeLogs(limit = 50) {
  return db
    .select()
    .from(changeLog)
    .orderBy(desc(changeLog.createdAt))
    .limit(limit);
}
