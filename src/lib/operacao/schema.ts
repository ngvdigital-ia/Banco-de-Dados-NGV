import { z } from "zod";

export const operationStateSchema = z.enum([
  "PENDING",
  "BLOCKED",
  "IN_MOTION",
  "READY_FOR_REVIEW",
]);

export const sourceStateSchema = z.enum([
  "OPERANT",
  "DEGRADED",
  "UNAVAILABLE",
  "UNVERIFIED",
]);

const blockerSchema = z.object({
  code: z.string().min(1).max(80),
  detail: z.string().min(1).max(240),
  source: z.string().min(1).max(40),
  severity: z.enum(["BLOCKED", "ATTENTION", "PENDING"]),
  occurred_at: z.string().datetime().nullable(),
}).strict();

const offerSchema = z.object({
  offer_id: z.string().regex(/^(?:ngv:[a-z0-9]+(?:-[a-z0-9]+)*|banco:\d+)$/),
  offer_slug: z.string().regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*|banco-\d+)$/),
  display_name: z.string().min(1).max(100),
  language: z.string().min(1).max(12),
  phase: z.number().int().min(0).max(7),
  state: operationStateSchema,
  blockers: z.array(blockerSchema),
  last_evidence_at: z.string().datetime().nullable(),
}).strict();

const eventSchema = z.object({
  event_id: z.string().min(1).max(160),
  offer_id: z.string().regex(/^(?:ngv:[a-z0-9]+(?:-[a-z0-9]+)*|banco:\d+)$/),
  phase: z.number().int().min(1).max(7),
  event_type: z.string().min(1).max(80),
  occurred_at: z.string().datetime(),
  source: z.string().min(1).max(40),
  state: z.string().min(1).max(80),
  blocker_code: z.string().min(1).max(80).nullable(),
}).strict();

export const operationSnapshotSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string().datetime(),
  source: z.enum(["ngv-hub-local-projection", "banco-ngv-runtime"]),
  mode: z.literal("read-only"),
  phases: z.array(z.object({
    phase: z.number().int().min(0).max(7),
    label: z.string().min(1).max(40),
  }).strict()).length(8),
  offers: z.array(offerSchema),
  sources: z.array(z.object({
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(40),
    state: sourceStateSchema,
    coverage: z.string().min(1).max(40),
    detail: z.string().min(1).max(180),
    last_read_at: z.string().datetime().nullable(),
  }).strict()),
  events: z.array(eventSchema).max(100),
}).strict();

export type OperationSnapshot = z.infer<typeof operationSnapshotSchema>;
export type OperationOffer = OperationSnapshot["offers"][number];
export type OperationEvent = OperationSnapshot["events"][number];
export type OperationSource = OperationSnapshot["sources"][number];
