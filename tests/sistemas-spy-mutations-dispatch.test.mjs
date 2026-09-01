import assert from "node:assert/strict";
import test from "node:test";
import { dispatchSpyMutationWithAudit } from "../src/lib/sistemas/spy/mutations-dispatch.mjs";

const actor = { id: "user_123", email: "operador@ngvdigital.com.br" };

function logSpy() {
  const calls = [];
  const logActionImpl = async (params) => { calls.push(params); };
  return { calls, logActionImpl };
}

function grantAccess() {
  return async (moduleId, capability) => {
    assert.equal(moduleId, "spy");
    assert.equal(capability, "mutate");
    return actor;
  };
}

function enableMutations() {
  return async () => {};
}

test("mutação bem-sucedida: chama requireAccessImpl(\"spy\",\"mutate\") ANTES da mutação e loga result=success", async () => {
  const { calls, logActionImpl } = logSpy();
  let mutationCalledWithActor;
  const result = await dispatchSpyMutationWithAudit({
    action: "oferta_create",
    requireMutationEnabledImpl: enableMutations(),
    requireAccessImpl: grantAccess(),
    logActionImpl,
    mutationImpl: async (a) => { mutationCalledWithActor = a; return { kind: "success", mutatedAt: "2026-08-16T00:00:00.000Z", data: { id: "o1" } }; },
    targetRefOf: (_a, result) => result.data.id,
    payload: { id: "o1", nome: "Oferta 1" },
  });

  assert.equal(result.kind, "success");
  assert.deepEqual(mutationCalledWithActor, actor);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    actorClerkId: "user_123",
    actorEmail: "operador@ngvdigital.com.br",
    module: "spy",
    action: "oferta_create",
    targetRef: "o1",
    result: "success",
    resultDetail: null,
    payload: { id: "o1", nome: "Oferta 1" },
  });
});

test("mutação que falhou (kind: error) loga result=failure com resultDetail = code, nunca null por omissão", async () => {
  const { calls, logActionImpl } = logSpy();
  const result = await dispatchSpyMutationWithAudit({
    action: "oferta_delete",
    requireMutationEnabledImpl: enableMutations(),
    requireAccessImpl: grantAccess(),
    logActionImpl,
    mutationImpl: async () => ({ kind: "error", code: "OFERTA_DELETE_NOT_FOUND", mutatedAt: null, data: null }),
    targetRefOf: () => "o1",
    payload: { id: "o1" },
  });

  assert.equal(result.kind, "error");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, "failure");
  assert.equal(calls[0].resultDetail, "OFERTA_DELETE_NOT_FOUND");
  assert.equal(calls[0].targetRef, "o1");
});

test("mutação not_configured loga result=failure com resultDetail = reason", async () => {
  const { calls, logActionImpl } = logSpy();
  await dispatchSpyMutationWithAudit({
    action: "config_update",
    requireMutationEnabledImpl: enableMutations(),
    requireAccessImpl: grantAccess(),
    logActionImpl,
    mutationImpl: async () => ({ kind: "not_configured", reason: "MISSING_CREDENTIALS", mutatedAt: null, data: null }),
    payload: {},
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result, "failure");
  assert.equal(calls[0].resultDetail, "MISSING_CREDENTIALS");
  assert.equal(calls[0].targetRef, null, "targetRefOf omitido cai pra null, nunca undefined");
});

test("acesso negado (requireAccessImpl rejeita): propaga o erro, NUNCA chama mutationImpl nem logActionImpl", async () => {
  let mutationCalls = 0;
  const { calls, logActionImpl } = logSpy();
  const acessoNegado = new Error("Acesso negado: sem permissão de mutate no módulo spy");

  await assert.rejects(
    () =>
      dispatchSpyMutationWithAudit({
        action: "oferta_create",
        requireMutationEnabledImpl: enableMutations(),
        requireAccessImpl: async () => { throw acessoNegado; },
        logActionImpl,
        mutationImpl: async () => { mutationCalls += 1; return { kind: "success", mutatedAt: "x", data: {} }; },
      }),
    acessoNegado,
  );

  assert.equal(mutationCalls, 0, "sem acesso, a mutação real nunca roda");
  assert.equal(calls.length, 0, "acesso negado não é uma mutação que aconteceu — não vira log");
});

test("targetRefOf omitido não quebra — vira null", async () => {
  const { calls, logActionImpl } = logSpy();
  await dispatchSpyMutationWithAudit({
    action: "leituras_batch_save",
    requireMutationEnabledImpl: enableMutations(),
    requireAccessImpl: grantAccess(),
    logActionImpl,
    mutationImpl: async () => ({ kind: "success", mutatedAt: "x", data: { leituras: [] } }),
  });
  assert.equal(calls[0].targetRef, null);
});

test("dependências obrigatórias ausentes lançam TypeError descritivo, nunca silenciam", async () => {
  await assert.rejects(
    () => dispatchSpyMutationWithAudit({ action: "oferta_create", requireMutationEnabledImpl: enableMutations(), requireAccessImpl: grantAccess(), mutationImpl: async () => ({ kind: "success" }) }),
    { name: "TypeError", message: /logActionImpl é obrigatório/ },
  );
  await assert.rejects(
    () => dispatchSpyMutationWithAudit({ action: "oferta_create", requireMutationEnabledImpl: enableMutations(), logActionImpl: async () => {}, mutationImpl: async () => ({ kind: "success" }) }),
    { name: "TypeError", message: /requireAccessImpl é obrigatório/ },
  );
  await assert.rejects(
    () => dispatchSpyMutationWithAudit({ action: "oferta_create", requireMutationEnabledImpl: enableMutations(), requireAccessImpl: grantAccess(), logActionImpl: async () => {} }),
    { name: "TypeError", message: /mutationImpl é obrigatório/ },
  );
  await assert.rejects(
    () => dispatchSpyMutationWithAudit({ requireMutationEnabledImpl: enableMutations(), requireAccessImpl: grantAccess(), logActionImpl: async () => {}, mutationImpl: async () => ({ kind: "success" }) }),
    { name: "TypeError", message: /action é obrigatório/ },
  );
});

test("flag de mutação desabilitada falha antes do RBAC, da API externa e da auditoria", async () => {
  let accessCalls = 0;
  let mutationCalls = 0;
  const { calls, logActionImpl } = logSpy();
  const disabled = new Error("Mutações do Spy estão desabilitadas");

  await assert.rejects(
    () =>
      dispatchSpyMutationWithAudit({
        action: "oferta_create",
        requireMutationEnabledImpl: async () => { throw disabled; },
        requireAccessImpl: async () => { accessCalls += 1; return actor; },
        logActionImpl,
        mutationImpl: async () => { mutationCalls += 1; return { kind: "success" }; },
      }),
    disabled,
  );

  assert.equal(accessCalls, 0, "flag desligada não chega ao RBAC");
  assert.equal(mutationCalls, 0, "flag desligada nunca chama a API externa");
  assert.equal(calls.length, 0, "flag desligada não grava auditoria de mutação inexistente");
});
