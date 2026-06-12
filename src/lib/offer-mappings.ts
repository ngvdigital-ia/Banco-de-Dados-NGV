import { db } from "@/db";
import { externalMappings, offerTracking } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractOfferFromCampaignName } from "@/lib/utmify";

export const PLATFORM_UTMIFY_CAMPAIGN = "utmify_campaign";
export const PLATFORM_UTMIFY_PRODUCT = "utmify_product";

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
