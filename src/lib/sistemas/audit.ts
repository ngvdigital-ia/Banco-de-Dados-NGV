import "server-only";
import { db } from "@/db";
import { moduleActionLog } from "@/db/schema";
import { commandDigest, detectSensitivePayload } from "@/lib/operacao/command-ledger.mjs";
import type { SystemId } from "@/lib/operacao/system-directory";

const MAX_TARGET_REF_LENGTH = 200; // kiss: teto arbitrário generoso; revisita se algum módulo precisar de mais.
const MAX_RESULT_DETAIL_LENGTH = 500;
const REDACTED = "[redacted]";

export type ModuleActionResult = "success" | "failure";

export interface LogModuleActionParams {
  actorClerkId: string;
  actorEmail: string;
  module: SystemId;
  action: string;
  targetRef?: string | null;
  result: ModuleActionResult;
  resultDetail?: string | null;
  /** Payload original da operação — NUNCA persistido; só o hash sha256 entra na tabela. */
  payload?: unknown;
}

// target_ref deve chegar já sanitizado do caller (ADR, Decisão 3) — esta função é a
// segunda linha de defesa: reusa detectSensitivePayload() de command-ledger.mjs
// (sem reescrever regex) e nunca deixa passar algo que pareça token/segredo.
function sanitizeTargetRef(targetRef: string | null | undefined): string | null {
  if (typeof targetRef !== "string" || targetRef.length === 0) return null;
  if (detectSensitivePayload(targetRef).sensitive) {
    console.warn("[module-audit] targetRef sinalizado como sensível — descartado, não persistido");
    return REDACTED;
  }
  return targetRef.slice(0, MAX_TARGET_REF_LENGTH);
}

function sanitizeResultDetail(resultDetail: string | null | undefined): string | null {
  if (typeof resultDetail !== "string" || resultDetail.length === 0) return null;
  if (detectSensitivePayload(resultDetail).sensitive) {
    console.warn("[module-audit] resultDetail sinalizado como sensível — descartado, não persistido");
    return REDACTED;
  }
  return resultDetail.slice(0, MAX_RESULT_DETAIL_LENGTH);
}

// sha256 do payload original (canonicalizado) — nunca o payload em si. `undefined`
// vira null: nem toda ação tem payload (ex.: read_analytics não tem corpo de mutação).
function hashPayload(payload: unknown): string | null {
  if (payload === undefined) return null;
  return commandDigest(payload);
}

// Registra uma ação administrativa de módulo interno no audit trail central do
// Banco NGV. Best-effort, mesmo padrão de logTeamAction() (src/lib/team-audit.ts):
// falha ao logar nunca derruba o request que já aconteceu.
export async function logModuleAction(params: LogModuleActionParams): Promise<void> {
  try {
    await db.insert(moduleActionLog).values({
      actorClerkId: params.actorClerkId,
      actorEmail: params.actorEmail,
      module: params.module,
      action: params.action,
      targetRef: sanitizeTargetRef(params.targetRef),
      result: params.result,
      resultDetail: sanitizeResultDetail(params.resultDetail),
      payloadHash: hashPayload(params.payload),
    });
  } catch (err) {
    console.error("[module-audit] failed to log action:", err);
  }
}
