// Núcleo puro da autorização/auditoria da ponte de funis. Testável sem Clerk,
// Drizzle ou variáveis de produção: o wrapper server-only injeta as dependências
// reais. A ordem é deliberada: autorização sempre acontece antes do GET/POST.

const MODULE_ID = "quiz";

function requireFunction(value, name, action) {
  if (typeof value !== "function") throw new TypeError(`dispatchQuizProjectWithAudit(${action}): ${name} é obrigatório`);
  return value;
}

export async function dispatchQuizProjectWithAudit(params) {
  const {
    action,
    capability,
    requireAccessImpl,
    operationImpl,
    preflightImpl,
    logActionImpl,
    intentLogActionImpl,
    targetRefOf,
    intentTargetRefOf,
    payload,
  } = params ?? {};
  if (typeof action !== "string" || action.length === 0) throw new TypeError("dispatchQuizProjectWithAudit: action é obrigatório");
  if (capability !== "read" && capability !== "mutate") throw new TypeError("dispatchQuizProjectWithAudit: capability inválida");
  requireFunction(requireAccessImpl, "requireAccessImpl", action);
  requireFunction(operationImpl, "operationImpl", action);
  requireFunction(logActionImpl, "logActionImpl", action);
  if (preflightImpl !== undefined) requireFunction(preflightImpl, "preflightImpl", action);
  if (intentLogActionImpl !== undefined) requireFunction(intentLogActionImpl, "intentLogActionImpl", action);

  // Sem actor autorizado não há rede, nem mesmo listagem do sistema externo.
  const actor = await requireAccessImpl(MODULE_ID, capability);

  // Validação local e consultas mínimas de vínculo ocorrem antes do intent
  // receipt. Um vínculo Banco inexistente não deixa rastro de criação nem
  // inicia um POST no Analytics.
  const preflightResult = preflightImpl ? await preflightImpl(actor) : null;
  if (preflightResult) {
    const detail = preflightResult.kind === "not_configured" ? preflightResult.reason : preflightResult.code;
    await logActionImpl({
      actorClerkId: actor.id,
      actorEmail: actor.email,
      module: MODULE_ID,
      action,
      targetRef: null,
      result: "failure",
      resultDetail: detail,
      payload,
    });
    return preflightResult;
  }

  // A intenção é o gate de durabilidade da escrita: se o banco de auditoria
  // estiver indisponível, a Promise rejeita aqui e operationImpl (POST) nunca
  // é alcançada. O recibo posterior abaixo continua best-effort.
  if (intentLogActionImpl) {
    await intentLogActionImpl({
      actorClerkId: actor.id,
      actorEmail: actor.email,
      module: MODULE_ID,
      action: `${action}_intent`,
      targetRef: typeof intentTargetRefOf === "function" ? intentTargetRefOf(actor) : null,
      result: "success",
      resultDetail: null,
      payload,
    });
  }
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
