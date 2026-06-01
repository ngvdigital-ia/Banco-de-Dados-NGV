"use server";

import { db } from "@/db";
import { metricsSnapshots, offerTracking } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_ROWS = 500;

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
  await requireAdmin();

  if (rows.length > MAX_ROWS) {
    throw new Error(`Limite de ${MAX_ROWS} linhas por importação excedido (recebido: ${rows.length}).`);
  }

  const values = rows.map((row) => ({
    date: new Date(row.date),
    entityType: row.entityType,
    entityId: row.entityId,
    source: "manual" as const,
    impressions: row.impressions ?? null,
    clicks: row.clicks ?? null,
    spend: row.spend ?? null,
    revenue: row.revenue ?? null,
    cpa: row.cpa ?? null,
    roas: row.roas ?? null,
  }));

  await db.insert(metricsSnapshots).values(values);

  revalidatePath("/metrics");
  revalidatePath("/");
  return { imported: rows.length };
}

/**
 * Importa ofertas da planilha de acompanhamento diretamente para offer_tracking.
 * A tabela `projects` está vazia por design (gotcha 1) — dados reais vivem em offer_tracking.
 */
export async function importOfferTracking(
  rows: {
    name: string;
    language: string;
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
    // niche e status não existem em offer_tracking — ignorados
  }[]
) {
  await requireAdmin();

  if (rows.length > MAX_ROWS) {
    throw new Error(`Limite de ${MAX_ROWS} linhas por importação excedido (recebido: ${rows.length}).`);
  }

  const values = rows.map((row) => ({
    name: row.name,
    language: row.language || "EN",
    ticket: row.ticket || null,
    copyVsl: row.copyVsl || null,
    copyAds: row.copyAds || null,
    editorAds: row.editorAds || null,
    editorVsl: row.editorVsl || null,
    adsEditedCount: row.adsCount ?? 0,
    adsRejectedCount: row.adsRejected ?? 0,
    validation: row.validation || "EM ANDAMENTO",
    preScale: row.preScale || "NAO",
    scale: row.scale || "NAO",
    observations: row.notes || null,
  }));

  await db.insert(offerTracking).values(values);

  revalidatePath("/offers");
  revalidatePath("/analytics/offers");
  revalidatePath("/");
  return `${rows.length} oferta(s) importada(s) com sucesso!`;
}
