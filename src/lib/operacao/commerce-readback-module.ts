import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { isOperationCommerceReadbackEnabled } from "./feature";
import {
  emptyNgvCoreCommerceSummary,
  fetchNgvCoreCommerceSummary,
  projectNgvCoreCommerceReadback,
} from "./ngv-core-commerce-summary.mjs";

const MAX_COMMERCE_READBACK_RECORDS = 200;

export type CommerceCoreState =
  | "SOURCE_STALE"
  | "PENDING_MAPPING"
  | "EXTERNAL"
  | "QUARANTINED"
  | "ACCESS_MISSING"
  | "READBACK_OBSERVED"
  | "SALE_OBSERVED"
  | "PENDING_SALE";

export type CommerceProjectionState = CommerceCoreState | "PENDING" | "DIVERGENT";

export type CommerceMetrics = {
  catalog_product_count: number;
  mapped_product_count: number;
  sale_count: number;
  active_access_count: number;
  quarantine_count: number;
  readback_count: number;
};

export type CommerceReadbackRecord = {
  offerTrackingId: number;
  identityState: "CONFIRMED" | "IDENTITY_PENDING" | "DIVERGENT";
  state: CommerceProjectionState;
  metrics: CommerceMetrics;
};

type CommerceCounts = Record<CommerceProjectionState, number>;

export type OperationCommerceReadbackProjection =
  | { kind: "disabled"; source: "ngv-core-commerce"; sourceFreshness: { state: "UNVERIFIED"; generatedAt: null }; records: []; counts: CommerceCounts }
  | { kind: "unavailable"; source: "ngv-core-commerce"; sourceFreshness: { state: "UNAVAILABLE"; generatedAt: null }; records: CommerceReadbackRecord[]; counts: CommerceCounts }
  | { kind: "ready"; source: "ngv-core-commerce"; sourceFreshness: { state: "OBSERVED"; generatedAt: string }; records: CommerceReadbackRecord[]; counts: CommerceCounts };

function emptyCounts(): CommerceCounts {
  return { SOURCE_STALE: 0, PENDING_MAPPING: 0, EXTERNAL: 0, QUARANTINED: 0, ACCESS_MISSING: 0, READBACK_OBSERVED: 0, SALE_OBSERVED: 0, PENDING_SALE: 0, PENDING: 0, DIVERGENT: 0 };
}

// Server-only BFF: it selects only Banco identity columns, invokes one Core
// aggregate read and projects only aggregate states/counts for a future UI.
export async function readOperationCommerceReadbackProjection(): Promise<OperationCommerceReadbackProjection> {
  if (!isOperationCommerceReadbackEnabled) {
    return {
      kind: "disabled",
      source: "ngv-core-commerce",
      sourceFreshness: { state: "UNVERIFIED", generatedAt: null },
      records: [],
      counts: emptyCounts(),
    };
  }
  try {
    const rows = await db
      .select({ id: offerTracking.id, canonicalOfferId: offerTracking.canonicalOfferId })
      .from(offerTracking)
      .orderBy(asc(offerTracking.id))
      .limit(MAX_COMMERCE_READBACK_RECORDS);
    const summary = await fetchNgvCoreCommerceSummary();
    const projection = projectNgvCoreCommerceReadback(rows, summary);
    if (summary.kind !== "success") {
      return {
        kind: "unavailable",
        source: "ngv-core-commerce",
        sourceFreshness: { state: "UNAVAILABLE", generatedAt: null },
        records: projection.records as CommerceReadbackRecord[],
        counts: projection.counts as CommerceCounts,
      };
    }
    return {
      kind: "ready",
      source: "ngv-core-commerce",
      sourceFreshness: { state: "OBSERVED", generatedAt: summary.generated_at },
      records: projection.records as CommerceReadbackRecord[],
      counts: projection.counts as CommerceCounts,
    };
  } catch {
    // Errors remain server-side. The UI gets only UNAVAILABLE and no remote
    // URL, product identity, key, body or PII.
    const projection = projectNgvCoreCommerceReadback([], emptyNgvCoreCommerceSummary());
    return {
      kind: "unavailable",
      source: "ngv-core-commerce",
      sourceFreshness: { state: "UNAVAILABLE", generatedAt: null },
      records: [],
      counts: projection.counts as CommerceCounts,
    };
  }
}
