"use server";

import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function importMetrics(
  rows: {
    date: string;
    entityType: string;
    entityId: number;
    impressions?: number | null;
    clicks?: number | null;
    spend?: string | null;
    revenue?: string | null;
    cpa?: string | null;
    roas?: string | null;
  }[]
) {
  for (const row of rows) {
    await db.insert(metricsSnapshots).values({
      date: new Date(row.date),
      entityType: row.entityType,
      entityId: row.entityId,
      source: "manual",
      impressions: row.impressions ?? null,
      clicks: row.clicks ?? null,
      spend: row.spend ?? null,
      revenue: row.revenue ?? null,
      cpa: row.cpa ?? null,
      roas: row.roas ?? null,
    });
  }

  revalidatePath("/metrics");
  revalidatePath("/");
  return { imported: rows.length };
}
