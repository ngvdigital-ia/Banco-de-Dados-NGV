"use server";

import { db } from "@/db";
import { metricsSnapshots, projects, changeLog } from "@/db/schema";
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

export async function importOfferTracking(
  rows: {
    name: string;
    niche: string;
    language: string;
    status: string;
    ticket: string;
    copyVsl: string;
    copyAds: string;
    editorAds: string;
    editorVsl: string;
    adsCount: number;
    adsRejected: number;
    validation: string;
    preScale: string;
    scale: string;
    notes: string;
  }[]
) {
  let imported = 0;

  for (const row of rows) {
    try {
      const [result] = await db.insert(projects).values({
        name: row.name,
        type: "vsl",
        niche: row.niche || "Emagrecimento",
        language: row.language,
        status: row.status as "escalou" | "nao_escalou" | "em_teste" | "rodando" | "pausado",
      }).returning({ id: projects.id });

      // Log the import with all the extra tracking data
      await db.insert(changeLog).values({
        entityType: "project",
        entityId: result.id,
        action: "create",
        changesJson: {
          source: "csv_import",
          ticket: row.ticket,
          copyVsl: row.copyVsl,
          copyAds: row.copyAds,
          editorAds: row.editorAds,
          editorVsl: row.editorVsl,
          adsCount: row.adsCount,
          adsRejected: row.adsRejected,
          validation: row.validation,
          preScale: row.preScale,
          scale: row.scale,
          notes: row.notes,
        },
      });

      imported++;
    } catch (err) {
      console.error(`[Import] Error importing ${row.name}:`, err);
    }
  }

  revalidatePath("/projects");
  revalidatePath("/analytics/offers");
  revalidatePath("/");
  return `${imported} oferta(s) importada(s) com sucesso!`;
}
