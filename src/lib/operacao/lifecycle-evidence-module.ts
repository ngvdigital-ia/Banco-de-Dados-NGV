import "server-only";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { isOperationLifecycleEvidenceEnabled } from "./feature";
import {
  emptyNgvCoreLifecycleSummary,
  fetchNgvCoreLifecycleSummary,
  projectNgvCoreLifecycleEvidence,
} from "./ngv-core-lifecycle-summary.mjs";

const MAX_LIFECYCLE_EVIDENCE_RECORDS = 500;

type LifecycleState = "PASS" | "FAIL" | "PENDING" | "STALE" | "DIVERGENT";
type LifecycleFacetState = "PASS" | "FAIL" | "PENDING" | "STALE";

type LifecycleFacet = {
  state: LifecycleFacetState;
  observedAt: string | null;
};

export type LifecycleEvidenceRecord = {
  offerTrackingId: number;
  offerId: string;
  identityState: "CONFIRMED" | "IDENTITY_PENDING" | "DIVERGENT";
  state: LifecycleState;
  facets: Record<"scope" | "local" | "visual" | "public_url" | "checkout" | "tracking" | "production", LifecycleFacet>;
};

export type OperationLifecycleEvidenceProjection =
  | { kind: "disabled"; source: "ngv-core-lifecycle"; sourceFreshness: { state: "UNVERIFIED"; generatedAt: null }; records: []; counts: Record<LifecycleState, number> }
  | { kind: "unavailable"; source: "ngv-core-lifecycle"; sourceFreshness: { state: "UNAVAILABLE"; generatedAt: null }; records: LifecycleEvidenceRecord[]; counts: Record<LifecycleState, number> }
  | { kind: "ready"; source: "ngv-core-lifecycle"; sourceFreshness: { state: "OBSERVED"; generatedAt: string }; records: LifecycleEvidenceRecord[]; counts: Record<LifecycleState, number> };

function emptyCounts(): Record<LifecycleState, number> {
  return { PASS: 0, FAIL: 0, PENDING: 0, STALE: 0, DIVERGENT: 0 };
}

// This is a BFF boundary: only id/canonical id cross it. The pure projector
// removes any upstream data outside the public cockpit model before UI use.
export async function readOperationLifecycleEvidenceProjection(): Promise<OperationLifecycleEvidenceProjection> {
  if (!isOperationLifecycleEvidenceEnabled) {
    return {
      kind: "disabled",
      source: "ngv-core-lifecycle",
      sourceFreshness: { state: "UNVERIFIED", generatedAt: null },
      records: [],
      counts: emptyCounts(),
    };
  }

  try {
    const rows = await db
      .select({ id: offerTracking.id, canonicalOfferId: offerTracking.canonicalOfferId })
      .from(offerTracking)
      .orderBy(desc(offerTracking.updatedAt))
      .limit(MAX_LIFECYCLE_EVIDENCE_RECORDS);
    const summary = await fetchNgvCoreLifecycleSummary();
    const projection = projectNgvCoreLifecycleEvidence(rows, summary);
    if (summary.kind !== "success") {
      return {
        kind: "unavailable",
        source: "ngv-core-lifecycle",
        sourceFreshness: { state: "UNAVAILABLE", generatedAt: null },
        records: projection.records as LifecycleEvidenceRecord[],
        counts: projection.counts,
      };
    }
    return {
      kind: "ready",
      source: "ngv-core-lifecycle",
      sourceFreshness: { state: "OBSERVED", generatedAt: summary.generated_at },
      records: projection.records as LifecycleEvidenceRecord[],
      counts: projection.counts,
    };
  } catch {
    // No detail leaves this server-only adapter: URLs, body and key remain
    // absent even when the remote service or local DB fails.
    const projection = projectNgvCoreLifecycleEvidence([], emptyNgvCoreLifecycleSummary());
    return {
      kind: "unavailable",
      source: "ngv-core-lifecycle",
      sourceFreshness: { state: "UNAVAILABLE", generatedAt: null },
      records: [],
      counts: projection.counts,
    };
  }
}
