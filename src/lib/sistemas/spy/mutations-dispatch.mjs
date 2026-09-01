// Núcleo TESTÁVEL do wiring de autorização + auditoria das mutações do Spy. Sem
// `import "server-only"` e sem importar src/lib/sistemas/authz.ts ou audit.ts diretamente aqui —
// mesma razão de todo outro adapter .mjs desta pasta (ver mutations-client.mjs): precisa rodar
// via `node --test` sem side-effects de servidor (Clerk, Drizzle/Neon). `authz.ts` e `audit.ts`
// arrastam `@/lib/admin-auth` e `@/db`, que exigem runtime real — este arquivo nunca toca nisso.
//
// Mesmo formato de cursos/push-dispatch.mjs em cima de push-client.mjs: lógica pura e testável
// aqui, wrapper "server-only" fino ao lado (mutations.ts) que injeta as dependências reais
// (`requireModuleAccess` + `logModuleAction`).
//
// DIFERENÇA em relação ao push-dispatch: aqui a AUTORIZAÇÃO também é injetada
// (`requireAccessImpl`) e chamada SEMPRE, ANTES de qualquer mutação real — é o motivo de este
// módulo existir (handoff Fase 5): nenhuma escrita no Spy acontece sem passar por
// `requireModuleAccess("spy", "mutate")` primeiro, com trilha em module_action_log (quem, o quê,
// alvo, resultado). Se `requireAccessImpl` rejeitar, o erro propaga SEM logar — ainda não há
// actor confiável nesse ponto (é exatamente o motivo do reject), e "acesso negado" não é uma
// mutação que aconteceu.
//
// `requireMutationEnabledImpl`, `requireAccessImpl`, `logActionImpl` e `mutationImpl` são
// OBRIGATÓRIOS (sem default) de propósito — só o wrapper server-only tem acesso às dependências
// reais; testes injetam stubs. A flag vem ANTES do RBAC para falhar fechado sem tocar a auditoria
// ou a API externa quando a escrita ainda não foi explicitamente liberada.

const MODULE_ID = "spy";

function requireFn(value, name, action) {
  if (typeof value !== "function") {
    throw new TypeError(`dispatchSpyMutationWithAudit(${action}): ${name} é obrigatório`);
  }
  return value;
}

/**
 * Roda `mutationImpl` SOMENTE depois de `requireAccessImpl(MODULE_ID, "mutate")` resolver (sem
 * lançar), e SEMPRE registra o resultado via `logActionImpl` (autor, alvo, resultado) — sucesso
 * ou falha, nunca best-effort silencioso do lado do caller: se a mutação falha, `resultDetail`
 * carrega o código/motivo, nunca fica null por omissão.
 *
 * @param {object} params
 * @param {string} params.action - nome estável da ação (ex.: "oferta_create") pro audit trail.
 * @param {(actor: {id:string,email:string}) => Promise<any>} params.mutationImpl - roda a
 *   mutação de verdade; recebe o actor autorizado (útil se algum dia a mutação precisar dele).
 * @param {(actor:{id:string,email:string}, result:any) => (string|null)} [params.targetRefOf] -
 *   deriva o target_ref sanitizável a partir do actor+resultado; default null.
 * @param {unknown} [params.payload] - payload original da operação, só o hash entra no log.
 */
export async function dispatchSpyMutationWithAudit(params) {
  const {
    action,
    mutationImpl,
    requireMutationEnabledImpl,
    requireAccessImpl,
    logActionImpl,
    targetRefOf,
    payload,
  } = params ?? {};

  if (typeof action !== "string" || action.length === 0) {
    throw new TypeError("dispatchSpyMutationWithAudit: action é obrigatório");
  }
  requireFn(requireMutationEnabledImpl, "requireMutationEnabledImpl", action);
  requireFn(requireAccessImpl, "requireAccessImpl", action);
  requireFn(logActionImpl, "logActionImpl", action);
  requireFn(mutationImpl, "mutationImpl", action);

  // Flag primeiro: habilitar leitura do painel nunca pode habilitar escrita por acidente.
  // Propositalmente FORA do try/log abaixo: uma rejeição aqui não é uma mutação que aconteceu.
  await requireMutationEnabledImpl();

  // Autorização depois da flag — sem operador com "mutate" no módulo spy, a mutação real nunca
  // roda. Também fica fora do try/log: rejeição de autorização não é mutação acontecida.
  const actor = await requireAccessImpl(MODULE_ID, "mutate");

  const result = await mutationImpl(actor);

  const resultDetail =
    result.kind === "success" ? null : result.kind === "not_configured" ? result.reason : result.code;

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
