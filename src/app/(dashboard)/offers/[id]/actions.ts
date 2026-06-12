"use server";

import { db } from "@/db";
import { offerTracking, changeLog } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getOfferDetail(id: number) {
  const [offer] = await db
    .select()
    .from(offerTracking)
    .where(eq(offerTracking.id, id))
    .limit(1);

  if (!offer) return null;

  // changelog: entityType = "offer" (confirmado em logChange em lib/changelog.ts)
  const changelog = await db
    .select()
    .from(changeLog)
    .where(
      and(
        eq(changeLog.entityType, "offer"),
        eq(changeLog.entityId, id),
      ),
    )
    .orderBy(desc(changeLog.createdAt))
    .limit(50);

  return { offer, changelog };
}
