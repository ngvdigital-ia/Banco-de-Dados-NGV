import snapshotData from "./operation.snapshot.json";
import { operationSnapshotSchema, type OperationSnapshot } from "./schema";

const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function loadOperationSnapshot(): OperationSnapshot {
  return operationSnapshotSchema.parse(snapshotData);
}
export function isOperationSnapshotStale(snapshot: OperationSnapshot, now = Date.now()): boolean {
  return now - new Date(snapshot.generated_at).getTime() > STALE_AFTER_MS;
}
