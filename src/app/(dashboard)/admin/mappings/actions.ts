"use server";

import { db } from "@/db";
import { externalMappings, metricsSnapshots, offerTracking } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { PLATFORM_UTMIFY_CAMPAIGN } from "@/lib/offer-mappings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrphanCampaign = {
  campaignName: string;
  totalSpend: number;
  lastDate: string;
};

export type OfferOption = {
  id: number;
  name: string;
};

export type ActiveMapping = {
  id: number;
  externalId: string;
  offerName: string;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Queries (sem mutação — não precisam de requireAdmin)
// ---------------------------------------------------------------------------

/**
 * Campanhas que chegam como "Outros" em metrics_snapshots e NÃO têm
 * mapeamento explícito em external_mappings.
 * Ordenado por spend acumulado desc, limit 100.
 */
export async function getOrphanCampaigns(): Promise<OrphanCampaign[]> {
  try {
    const rows = await db.execute(sql`
      SELECT
        ms.extra_data->>'campaignName'   AS campaign_name,
        SUM(ms.spend::numeric)           AS total_spend,
        MAX(ms.date)::text               AS last_date
      FROM metrics_snapshots ms
      WHERE
        ms.entity_type = 'utmify_campaign_daily'
        AND ms.extra_data->>'offerName' = 'Outros'
        AND NOT EXISTS (
          SELECT 1
          FROM external_mappings em
          WHERE em.platform = ${PLATFORM_UTMIFY_CAMPAIGN}
            AND lower(trim(em.external_id)) = lower(trim(ms.extra_data->>'campaignName'))
        )
      GROUP BY ms.extra_data->>'campaignName'
      ORDER BY total_spend DESC NULLS LAST
      LIMIT 100
    `);

    return rows.rows.map((r) => ({
      campaignName: String(r.campaign_name ?? ""),
      totalSpend: Number(r.total_spend ?? 0),
      lastDate: String(r.last_date ?? ""),
    }));
  } catch (err) {
    console.error("[mappings] getOrphanCampaigns failed:", err);
    return [];
  }
}

/** Lista todas as ofertas para o select de mapeamento. */
export async function getOffersForMapping(): Promise<OfferOption[]> {
  try {
    const rows = await db
      .select({ id: offerTracking.id, name: offerTracking.name })
      .from(offerTracking)
      .orderBy(offerTracking.name)
      .limit(500);
    return rows;
  } catch (err) {
    console.error("[mappings] getOffersForMapping failed:", err);
    return [];
  }
}

/** Lista os mapeamentos ativos de campanhas UTMify. */
export async function getActiveMappings(): Promise<ActiveMapping[]> {
  try {
    const rows = await db
      .select({
        id: externalMappings.id,
        externalId: externalMappings.externalId,
        offerName: offerTracking.name,
        createdAt: externalMappings.createdAt,
      })
      .from(externalMappings)
      .innerJoin(offerTracking, eq(externalMappings.entityId, offerTracking.id))
      .where(eq(externalMappings.platform, PLATFORM_UTMIFY_CAMPAIGN))
      .orderBy(desc(externalMappings.createdAt))
      .limit(200);
    return rows;
  } catch (err) {
    console.error("[mappings] getActiveMappings failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mutations (requerem admin)
// ---------------------------------------------------------------------------

const saveMappingSchema = z.object({
  externalId: z.string().trim().min(1, "Nome da campanha obrigatório").max(500),
  offerId: z.coerce.number().int().positive("Oferta inválida"),
  platform: z.string().trim().min(1).max(100),
});

/**
 * Salva um mapeamento campanha→oferta.
 * Usa delete-then-insert para ser compatível com qualquer versão do unique index
 * (antigo: entity_type+entity_id+platform  ou  novo: platform+external_id).
 */
export async function saveMapping(formData: FormData) {
  await requireAdmin();

  const parsed = saveMappingSchema.parse({
    externalId: formData.get("externalId"),
    offerId: formData.get("offerId"),
    platform: formData.get("platform"),
  });

  try {
    // Delete-then-insert: funciona com qualquer índice único vigente.
    await db
      .delete(externalMappings)
      .where(
        and(
          eq(externalMappings.platform, parsed.platform),
          eq(externalMappings.externalId, parsed.externalId),
        ),
      );

    await db.insert(externalMappings).values({
      entityType: "offer",
      entityId: parsed.offerId,
      platform: parsed.platform,
      externalId: parsed.externalId,
    });

    revalidatePath("/admin/mappings");
  } catch (err) {
    console.error("[mappings] saveMapping failed:", err);
    // Unique constraint do índice antigo (entity_type, entity_id, platform)
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      throw new Error(
        "Limite do índice antigo — aplique a migration 0008 para mapear N campanhas por oferta.",
      );
    }
    throw new Error("Erro ao salvar mapeamento. Tente novamente.");
  }
}

/** Remove um mapeamento por id. */
export async function deleteMapping(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("id obrigatório");

  try {
    await db.delete(externalMappings).where(eq(externalMappings.id, id));
    revalidatePath("/admin/mappings");
  } catch (err) {
    console.error("[mappings] deleteMapping failed:", err);
    throw new Error("Erro ao remover mapeamento.");
  }
}

/**
 * Reprocessa o histórico de métricas:
 * Para cada mapeamento utmify_campaign, atualiza o offerName nos snapshots
 * cujo campaignName (normalizado) bate com o externalId mapeado.
 *
 * Usa sql template (parametrizado via drizzle) — NUNCA interpolação de string crua.
 */
export async function backfillCampaignOffers(): Promise<{ updated: number }> {
  await requireAdmin();

  const mappings = await db
    .select({
      externalId: externalMappings.externalId,
      offerName: offerTracking.name,
    })
    .from(externalMappings)
    .innerJoin(offerTracking, eq(externalMappings.entityId, offerTracking.id))
    .where(eq(externalMappings.platform, PLATFORM_UTMIFY_CAMPAIGN))
    .limit(2000);

  let total = 0;

  for (const m of mappings) {
    try {
      const result = await db.execute(sql`
        UPDATE metrics_snapshots
        SET extra_data = jsonb_set(extra_data, '{offerName}', to_jsonb(${m.offerName}::text))
        WHERE
          entity_type = 'utmify_campaign_daily'
          AND lower(trim(extra_data->>'campaignName')) = lower(trim(${m.externalId}))
      `);
      // neon-http retorna rowCount via result.rowCount
      total += (result.rowCount ?? 0);
    } catch (err) {
      console.error(`[mappings] backfill failed for "${m.externalId}":`, err);
      // Continua pro próximo — não derruba o batch inteiro
    }
  }

  revalidatePath("/admin/mappings");
  return { updated: total };
}
