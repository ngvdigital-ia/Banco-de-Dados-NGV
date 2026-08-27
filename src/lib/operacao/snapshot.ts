import "server-only";
import { desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { operationSnapshotSchema, type OperationSnapshot } from "./schema";
import { projectRecentOffers, RECENT_OFFERS_LIMIT, ROLLING_WINDOW_MS } from "./recent-offers.mjs";

function recentOffersCutoff(now: Date): Date {
  return new Date(now.getTime() - ROLLING_WINDOW_MS);
}

export async function loadOperationSnapshot(now = new Date()): Promise<OperationSnapshot> {
  const rows = await db
    .select({
      id: offerTracking.id,
      name: offerTracking.name,
      language: offerTracking.language,
      createdAt: offerTracking.createdAt,
      updatedAt: offerTracking.updatedAt,
      copyVslStatus: offerTracking.copyVslStatus,
      copyCriativosStatus: offerTracking.copyCriativosStatus,
      vslInVturb: offerTracking.vslInVturb,
      siteCreated: offerTracking.siteCreated,
      productCreated: offerTracking.productCreated,
      productApproved: offerTracking.productApproved,
      campaignsActive: offerTracking.campaignsActive,
      validation: offerTracking.validation,
    })
    .from(offerTracking)
    .where(gte(offerTracking.createdAt, recentOffersCutoff(now)))
    .orderBy(desc(offerTracking.createdAt))
    .limit(RECENT_OFFERS_LIMIT);

  // O artefato versionado do piloto não participa da leitura runtime: ele pode
  // continuar útil como fixture, mas nunca define estado, identidade ou freshness.
  const snapshot = projectRecentOffers(rows, now);
  return operationSnapshotSchema.parse(snapshot);
}
