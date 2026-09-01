"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logModuleAction } from "@/lib/sistemas/audit";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { dispatchQuizProjectWithAudit } from "@/lib/sistemas/quiz/projects-dispatch.mjs";
import {
  listQuizDashboardProjects,
  provisionQuizDashboardProjectServer,
} from "@/lib/sistemas/quiz/projects";
import type { QuizProvisionInput } from "@/lib/sistemas/quiz/projects-client.mjs";

const QUIZ_PATH = "/sistemas/quiz";
const formatSchema = z.enum(["quiz", "vsl", "presell"]);

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.port;
  } catch {
    return false;
  }
}

const createFunnelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  finalUrl: z.string().trim().min(1).max(2048).refine(isHttpsUrl, "Informe uma URL HTTPS válida."),
  format: formatSchema,
  bancoOfferTrackingId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isSafeInteger(value) && value > 0), "Informe um ID positivo do Banco."),
});

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function parseCreateFunnelFormData(formData: FormData):
  | { success: true; data: QuizProvisionInput }
  | { success: false; data: null } {
  const parsed = createFunnelSchema.safeParse({
    name: formValue(formData, "name"),
    finalUrl: formValue(formData, "finalUrl"),
    format: formValue(formData, "format"),
    bancoOfferTrackingId: formValue(formData, "bancoOfferTrackingId"),
  });
  if (!parsed.success) return { success: false, data: null };
  return { success: true, data: parsed.data };
}

async function requireAccessImpl(moduleId: "quiz", capability: "read" | "mutate") {
  return requireModuleAccess(moduleId, capability);
}

/** Lista a projeção segura de funis; a chave pública nunca entra nessa resposta. */
export async function listarFunisQuizAction() {
  return dispatchQuizProjectWithAudit({
    action: "funnel_list",
    capability: "read",
    requireAccessImpl,
    operationImpl: listQuizDashboardProjects,
    logActionImpl: logModuleAction,
    targetRefOf: () => "projects",
  });
}

/**
 * Provisiona via FormData nativo. A autorização mutate ocorre no dispatcher
 * antes do parsing útil e, principalmente, antes de qualquer POST upstream.
 * `format` é orientação de sessão: o adapter não o inclui no contrato remoto.
 */
export async function criarFunilQuizAction(formData: FormData) {
  const auditPayload = {
    name: formValue(formData, "name") ?? null,
    finalUrl: formValue(formData, "finalUrl") ?? null,
    format: formValue(formData, "format") ?? null,
    bancoOfferTrackingId: formValue(formData, "bancoOfferTrackingId") ?? null,
  };

  const result = await dispatchQuizProjectWithAudit({
    action: "funnel_provision",
    capability: "mutate",
    requireAccessImpl,
    operationImpl: () => {
      const parsed = parseCreateFunnelFormData(formData);
      return parsed.success
        ? provisionQuizDashboardProjectServer(parsed.data)
        : Promise.resolve({ kind: "error", code: "PROVISION_INPUT_INVALID", receivedAt: null, data: null } as const);
    },
    logActionImpl: logModuleAction,
    targetRefOf: (
      _actor: { id: string; email: string },
      actionResult: { kind: string; data?: { project?: { projectId?: string } } },
    ) =>
      actionResult.kind === "success" ? actionResult.data?.project?.projectId ?? null : null,
    payload: auditPayload,
  });
  if (result.kind === "success") revalidatePath(QUIZ_PATH);
  return result;
}
