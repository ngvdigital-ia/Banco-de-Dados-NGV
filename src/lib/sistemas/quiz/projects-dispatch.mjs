// Núcleo puro da autorização/auditoria da ponte de funis. Testável sem Clerk,
// Drizzle ou variáveis de produção: o wrapper server-only injeta as dependências
// reais. A ordem é deliberada: autorização sempre acontece antes do GET/POST.

const MODULE_ID = "quiz";

function requireFunction(value, name, action) {
  if (typeof value !== "function") throw new TypeError(`dispatchQuizProjectWithAudit(${action}): ${name} é obrigatório`);
  return value;
}

export async function dispatchQuizProjectWithAudit(params) {
  const { action, capability, requireAccessImpl, operationImpl, logActionImpl, targetRefOf, payload } = params ?? {};
  if (typeof action !== "string" || action.length === 0) throw new TypeError("dispatchQuizProjectWithAudit: action é obrigatório");
  if (capability !== "read" && capability !== "mutate") throw new TypeError("dispatchQuizProjectWithAudit: capability inválida");
  requireFunction(requireAccessImpl, "requireAccessImpl", action);
  requireFunction(operationImpl, "operationImpl", action);
  requireFunction(logActionImpl, "logActionImpl", action);

  // Sem actor autorizado não há rede, nem mesmo listagem do sistema externo.
  const actor = await requireAccessImpl(MODULE_ID, capability);
  const result = await operationImpl(actor);
  const resultDetail = result.kind === "success" ? null : result.kind === "not_configured" ? result.reason : result.code;

  await logActionImpl({
    actorClerkId: actor.id,
    actorEmail: actor.email,
    module: MODULE_ID,
    action,
    targetRef: typeof targetRefOf === "function" ? targetRefOf(actor, result) : null,
    result: result.kind === "success" ? "success" : "failure",
    resultDetail,
    payload,
  });
  return result;
}
