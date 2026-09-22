import { db } from "@/db";
import { externalMappings, offerTracking } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractOfferFromCampaignName } from "@/lib/utmify";

// Constantes re-exportadas do modulo CLIENT-SAFE (ver offer-mappings-shared.ts).
export { PLATFORM_UTMIFY_CAMPAIGN, PLATFORM_UTMIFY_PRODUCT } from "@/lib/offer-mappings-shared";
import { PLATFORM_UTMIFY_CAMPAIGN } from "@/lib/offer-mappings-shared";
import { PLATFORM_UTMIFY_PRODUCT } from "@/lib/offer-mappings-shared";

/**
 * Busca todos os mapeamentos de campanha do banco e retorna um mapa normalizado:
 * { [externalId lowercase trim]: offerName }
 *
 * Defensivo: se a query falhar (DB indisponível, tabela vazia etc.),
 * retorna {} sem derrubar o cron — ele usará o fallback hardcoded.
 */
export async function getDbCampaignMappings(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({
        externalId: externalMappings.externalId,
        offerName: offerTracking.name,
      })
      .from(externalMappings)
      .innerJoin(
        offerTracking,
        eq(externalMappings.entityId, offerTracking.id),
      )
      .where(eq(externalMappings.platform, PLATFORM_UTMIFY_CAMPAIGN))
      .limit(2000);

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.externalId.toLowerCase().trim()] = row.offerName;
    }
    return map;
  } catch (err) {
    console.error("[offer-mappings] getDbCampaignMappings failed:", err);
    return {};
  }
}

/**
 * Resolve o nome da oferta para um nome de campanha.
 * Ordem de prioridade:
 *   1. Mapeamento explícito no banco (dbMap)
 *   2. Fallback hardcoded (extractOfferFromCampaignName)
 */
export function resolveOfferFromCampaign(
  campaignName: string,
  dbMap: Record<string, string>,
): string {
  const key = campaignName.toLowerCase().trim();
  if (dbMap[key]) return dbMap[key];
  return extractOfferFromCampaignName(campaignName);
}

/**
 * Busca todos os mapeamentos de campanha do banco e retorna um mapa normalizado:
 * { [externalId lowercase trim]: offerId }
 *
 * Defensivo: se a query falhar (DB indisponível, tabela vazia etc.),
 * retorna {} sem derrubar o webhook.
 */
export async function getDbCampaignOfferIds(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({
        externalId: externalMappings.externalId,
        offerId: offerTracking.id,
      })
      .from(externalMappings)
      .innerJoin(
        offerTracking,
        eq(externalMappings.entityId, offerTracking.id),
      )
      .where(and(
        eq(externalMappings.entityType, "offer"),
        eq(externalMappings.platform, PLATFORM_UTMIFY_CAMPAIGN),
      ))
      .limit(2000);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.externalId.toLowerCase().trim()] = row.offerId;
    }
    return map;
  } catch (err) {
    console.error("[offer-mappings] getDbCampaignOfferIds failed:", err);
    return {};
  }
}

export { resolveOfferTrackingId } from "./offer-attribution.mjs";

/**
 * Extrai o ID numérico da campanha a partir do utmCampaign.
 * O formato de produção grava "<nome da campanha>|<id numérico>".
 * Pega o trecho após o ÚLTIMO "|", faz trim e retorna se casar com /^\d{6,}$/.
 * null / undefined / "" / strings inválidas retornam null.
 */
export function parseCampaignId(utmCampaign: string | null | undefined): string | null {
  if (!utmCampaign) return null;
  const lastPipe = utmCampaign.lastIndexOf("|");
  if (lastPipe === -1) return null;
  const candidate = utmCampaign.slice(lastPipe + 1).trim();
  if (/^\d{6,}$/.test(candidate)) {
    return candidate;
  }
  return null;
}

/**
 * Busca todos os mapeamentos de produto Utmify do banco e retorna um mapa:
 * { [externalId trim]: offerId }
 * Chave com trim(), SEM lowercase (productCode é opaco e case-sensitive).
 *
 * Defensivo: se a query falhar, retorna {} sem derrubar o webhook.
 */
export async function getDbProductOfferIds(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({
        externalId: externalMappings.externalId,
        offerId: offerTracking.id,
      })
      .from(externalMappings)
      .innerJoin(
        offerTracking,
        eq(externalMappings.entityId, offerTracking.id),
      )
      .where(and(
        eq(externalMappings.entityType, "offer"),
        eq(externalMappings.platform, PLATFORM_UTMIFY_PRODUCT),
      ))
      .limit(2000);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.externalId.trim()] = row.offerId;
    }
    return map;
  } catch (err) {
    console.error("[offer-mappings] getDbProductOfferIds failed:", err);
    return {};
  }
}

/**
 * Busca todos os mapeamentos de campaign_id Utmify do banco e retorna um mapa:
 * { [externalId trim]: offerId }
 * Chave com trim(), SEM lowercase (a chave guardada será o ID numérico, não o nome).
 *
 * Defensivo: se a query falhar, retorna {} sem derrubar o webhook.
 */
export async function getDbCampaignIdOfferIds(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({
        externalId: externalMappings.externalId,
        offerId: offerTracking.id,
      })
      .from(externalMappings)
      .innerJoin(
        offerTracking,
        eq(externalMappings.entityId, offerTracking.id),
      )
      .where(and(
        eq(externalMappings.entityType, "offer"),
        eq(externalMappings.platform, PLATFORM_UTMIFY_CAMPAIGN),
      ))
      .limit(2000);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.externalId.trim()] = row.offerId;
    }
    return map;
  } catch (err) {
    console.error("[offer-mappings] getDbCampaignIdOfferIds failed:", err);
    return {};
  }
}

export type OfferAttributionInput = {
  productCode?: string | null;
  utmCampaign?: string | null;
};

export type OfferAttributionMaps = {
  byProduct: Record<string, number>;
  byCampaignId: Record<string, number>;
};

export type OfferAttributionResult = {
  id: number | null;
  resolution: "product" | "campaign_id" | "unresolved";
};

/**
 * Resolve a atribuição de venda -> oferta (M8).
 * FUNÇÃO PURA: sem banco, sem I/O, sem Date, sem console.
 * Ordem:
 *   1. tenta productCode (trim, match exato no byProduct) -> { id, resolution: "product" }
 *   2. senão parseCampaignId(utmCampaign) -> byCampaignId -> { id, resolution: "campaign_id" }
 *   3. senão { id: null, resolution: "unresolved" }
 */
export function resolveOfferAttribution(
  input: OfferAttributionInput,
  maps: OfferAttributionMaps,
): OfferAttributionResult {
  if (input?.productCode) {
    const code = input.productCode.trim();
    if (code && maps?.byProduct && maps.byProduct[code] !== undefined) {
      return { id: maps.byProduct[code], resolution: "product" };
    }
  }

  const campaignId = parseCampaignId(input?.utmCampaign);
  if (campaignId && maps?.byCampaignId && maps.byCampaignId[campaignId] !== undefined) {
    return { id: maps.byCampaignId[campaignId], resolution: "campaign_id" };
  }

  return { id: null, resolution: "unresolved" };
}


