"use server";

import { logModuleAction } from "@/lib/sistemas/audit";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { dispatchQuizProjectWithAudit } from "@/lib/sistemas/quiz/projects-dispatch.mjs";
import { listQuizDashboardProjects } from "@/lib/sistemas/quiz/projects";

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
