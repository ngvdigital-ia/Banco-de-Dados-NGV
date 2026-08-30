import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { projectOfferPublicationFromSiteUrls } from "./offer-publication-projection.mjs";
import { isOperationDeploymentDomainsModuleEnabled } from "./feature";

const CANONICAL_OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PUBLICATION_RECORDS = 500;

export type PublicationRecord = {
  offerId: string;
  offerTrackingId: number;
  localRegistrationState: "REGISTERED" | "PENDING";
  externalVerificationState: "PENDING";
  registeredTargets: string[];
  updatedAt: string | null;
};

export type OperationPublicationProjection =
  | { kind: "disabled"; source: "offer_tracking.site_urls" }
  | { kind: "migration_unverified"; source: "offer_tracking.site_urls" }
  | { kind: "unavailable"; source: "offer_tracking.site_urls" }
  | {
      kind: "ready";
      source: "offer_tracking.site_urls";
      records: PublicationRecord[];
      counts: {
        offers: number;
        registered: number;
        pending: number;
        pendingIdentity: number;
        targets: Record<string, number>;
      };
      observedAt: string | null;
    };

function asIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function isMissingColumnOrRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return (
    candidate.code === "42P01" ||
    candidate.code === "42703" ||
    candidate.cause?.code === "42P01" ||
    candidate.cause?.code === "42703"
  );
}

// A projeção descarta os endereços antes de deixar a camada de acesso. Assim,
// "REGISTERED" significa somente que um endereço existe no registro local.
export async function readOperationPublicationProjection(): Promise<OperationPublicationProjection> {
  if (!isOperationDeploymentDomainsModuleEnabled) {
    return { kind: "disabled", source: "offer_tracking.site_urls" };
  }

  try {
    const rows = await db
      .select({
        offerTrackingId: offerTracking.id,
        canonicalOfferId: offerTracking.canonicalOfferId,
        siteUrls: offerTracking.siteUrls,
        updatedAt: offerTracking.updatedAt,
      })
      .from(offerTracking)
      .orderBy(desc(offerTracking.updatedAt))
      .limit(MAX_PUBLICATION_RECORDS);

    const records = rows.map((row): PublicationRecord => {
      const publication = projectOfferPublicationFromSiteUrls(row.siteUrls);
      const offerId =
        row.canonicalOfferId && CANONICAL_OFFER_ID.test(row.canonicalOfferId)
          ? row.canonicalOfferId
          : "PENDING";
      return {
        offerId,
        offerTrackingId: row.offerTrackingId,
        localRegistrationState: publication.local_registration_state,
        externalVerificationState: "PENDING",
        registeredTargets: [...publication.registered_targets],
        updatedAt: asIso(row.updatedAt),
      };
    });

    const targets: Record<string, number> = {
      domain: 0,
      vsl: 0,
      quiz: 0,
      whites: 0,
      custom: 0,
    };
    for (const record of records) {
      for (const target of record.registeredTargets)
        targets[target] = (targets[target] ?? 0) + 1;
    }
    const registered = records.filter(
      (record) => record.localRegistrationState === "REGISTERED",
    ).length;
    const pendingIdentity = records.filter(
      (record) => record.offerId === "PENDING",
    ).length;

    return {
      kind: "ready",
      source: "offer_tracking.site_urls",
      records,
      counts: {
        offers: records.length,
        registered,
        pending: records.length - registered,
        pendingIdentity,
        targets,
      },
      observedAt: records.find((record) => record.updatedAt)?.updatedAt ?? null,
    };
  } catch (error) {
    if (isMissingColumnOrRelation(error)) {
      return {
        kind: "migration_unverified",
        source: "offer_tracking.site_urls",
      };
    }
    return { kind: "unavailable", source: "offer_tracking.site_urls" };
  }
}
