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

// target_ref deve chegar JÁ SANITIZADO do caller (ADR, Decisão 3). Esta função é uma
// rede de segurança ESTREITA, não uma garantia: reusa detectSensitivePayload() de
// command-ledger.mjs, que reconhece SEGREDO/TOKEN (JWT, chave AWS/OpenAI/GitHub/Slack,
// PEM, hex de 64) — e NÃO reconhece PII.
//
// Medido pelo gate held-out em 2026-08-16: e-mail, CPF, telefone, nome e número de
// cartão passam por aqui SEM serem sinalizados. Portanto, quem chamar logModuleAction()
// é responsável por não passar PII em target_ref/result_detail — este arquivo não salva
// ninguém disso. Ao ligar o primeiro caller real (Fase 2/3), o QA daquele ciclo tem de
// verificar a sanitização NO CALLER.
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
