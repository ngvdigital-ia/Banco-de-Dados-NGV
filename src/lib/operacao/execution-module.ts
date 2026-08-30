import "server-only";

import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { operationOfferBuildJobs } from "@/db/schema";
import { isOperationExecutionModuleEnabled } from "./feature";

const EXECUTION_STATES = [
  "queued",
  "leased",
  "running",
  "ready_for_review",
  "waiting_human",
  "failed",
  "completed",
] as const;

type ExecutionState = (typeof EXECUTION_STATES)[number];

export type ExecutionReceipt = {
  offerId: string;
  offerTrackingId: number | null;
  kind: "tracking" | "embed";
  targetKey: string;
  outboxState: ExecutionState;
  attempts: number;
  maxAttempts: number;
  failureCode: string | null;
  remoteUpdatedAt: string | null;
  completedAt: string | null;
  lastReadAt: string;
};

export type OperationExecutionProjection =
  | { kind: "disabled"; source: "operation_offer_build_jobs" }
  | { kind: "migration_unverified"; source: "operation_offer_build_jobs" }
  | { kind: "unavailable"; source: "operation_offer_build_jobs" }
  | {
      kind: "ready";
      source: "operation_offer_build_jobs";
      receipts: ExecutionReceipt[];
      counts: Record<ExecutionState, number>;
      observedAt: string | null;
    };

function asIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function asExecutionState(value: unknown): ExecutionState | null {
  return typeof value === "string" &&
    EXECUTION_STATES.includes(value as ExecutionState)
    ? (value as ExecutionState)
    : null;
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === "42P01" || candidate.cause?.code === "42P01";
}

function emptyCounts(): Record<ExecutionState, number> {
  return {
    queued: 0,
    leased: 0,
    running: 0,
    ready_for_review: 0,
    waiting_human: 0,
    failed: 0,
    completed: 0,
  };
}

// Leitura local deliberadamente estreita: a seleção não contém hash de job,
// payload, URL nem erro remoto bruto. O painel só recebe o recibo sanitizado.
export async function readOperationExecutionProjection(): Promise<OperationExecutionProjection> {
  if (!isOperationExecutionModuleEnabled) {
    return { kind: "disabled", source: "operation_offer_build_jobs" };
  }

  try {
    const [stateCounts, rows] = await Promise.all([
      db
        .select({
          outboxState: operationOfferBuildJobs.outboxState,
          total: count(),
        })
        .from(operationOfferBuildJobs)
        .groupBy(operationOfferBuildJobs.outboxState),
      db
        .select({
          offerId: operationOfferBuildJobs.offerId,
          offerTrackingId: operationOfferBuildJobs.offerTrackingId,
          kind: operationOfferBuildJobs.kind,
          targetKey: operationOfferBuildJobs.targetKey,
          outboxState: operationOfferBuildJobs.outboxState,
          attempts: operationOfferBuildJobs.attempts,
          maxAttempts: operationOfferBuildJobs.maxAttempts,
          failureCode: operationOfferBuildJobs.failureCode,
          remoteUpdatedAt: operationOfferBuildJobs.remoteUpdatedAt,
          completedAt: operationOfferBuildJobs.completedAt,
          lastReadAt: operationOfferBuildJobs.lastReadAt,
        })
        .from(operationOfferBuildJobs)
        .orderBy(desc(operationOfferBuildJobs.lastReadAt))
        .limit(50),
    ]);

    const counts = emptyCounts();
    for (const item of stateCounts) {
      const state = asExecutionState(item.outboxState);
      if (state) counts[state] = Number(item.total) || 0;
    }

    const receipts = rows.flatMap((row): ExecutionReceipt[] => {
      const state = asExecutionState(row.outboxState);
      const lastReadAt = asIso(row.lastReadAt);
      if (
        !state ||
        !lastReadAt ||
        (row.kind !== "tracking" && row.kind !== "embed")
      )
        return [];
      return [
        {
          offerId: row.offerId,
          offerTrackingId: row.offerTrackingId,
          kind: row.kind,
          targetKey: row.targetKey,
          outboxState: state,
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          failureCode: row.failureCode,
          remoteUpdatedAt: asIso(row.remoteUpdatedAt),
          completedAt: asIso(row.completedAt),
          lastReadAt,
        },
      ];
    });

    return {
      kind: "ready",
      source: "operation_offer_build_jobs",
      receipts,
      counts,
      observedAt: receipts[0]?.lastReadAt ?? null,
    };
  } catch (error) {
    if (isMissingRelation(error)) {
      return {
        kind: "migration_unverified",
        source: "operation_offer_build_jobs",
      };
    }
    return { kind: "unavailable", source: "operation_offer_build_jobs" };
  }
}
