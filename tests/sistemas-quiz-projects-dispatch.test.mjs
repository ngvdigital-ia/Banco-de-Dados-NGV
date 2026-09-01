import assert from "node:assert/strict";
import test from "node:test";
import { dispatchQuizProjectWithAudit } from "../src/lib/sistemas/quiz/projects-dispatch.mjs";
import { validateBancoOfferTrackingLink } from "../src/lib/sistemas/quiz/projects-preflight.mjs";

test("nega mutate antes de qualquer operação upstream ou audit", async () => {
  let upstreamCalls = 0;
  let auditCalls = 0;
  await assert.rejects(
    dispatchQuizProjectWithAudit({
      action: "funnel_provision",
      capability: "mutate",
      requireAccessImpl: async () => { throw new Error("forbidden"); },
      operationImpl: async () => { upstreamCalls += 1; return { kind: "success", receivedAt: "now", data: {} }; },
      logActionImpl: async () => { auditCalls += 1; },
    }),
    /forbidden/,
  );
  assert.equal(upstreamCalls, 0);
  assert.equal(auditCalls, 0);
});

test("operação autorizada audita apenas identificador seguro e código de falha", async () => {
  let logged;
  const result = await dispatchQuizProjectWithAudit({
    action: "funnel_provision",
    capability: "mutate",
    requireAccessImpl: async (module, capability) => {
      assert.equal(module, "quiz");
      assert.equal(capability, "mutate");
      return { id: "clerk_1", email: "operator@example.test" };
    },
    operationImpl: async () => ({ kind: "error", code: "UNAUTHORIZED", receivedAt: null, data: null }),
    logActionImpl: async (entry) => { logged = entry; },
    targetRefOf: () => "gelatina-bariatrica",
    payload: { name: "Gelatina", finalUrl: "https://gelatina.example.test" },
  });
  assert.equal(result.code, "UNAUTHORIZED");
  assert.deepEqual(logged, {
    actorClerkId: "clerk_1",
    actorEmail: "operator@example.test",
    module: "quiz",
    action: "funnel_provision",
    targetRef: "gelatina-bariatrica",
    result: "failure",
    resultDetail: "UNAUTHORIZED",
    payload: { name: "Gelatina", finalUrl: "https://gelatina.example.test" },
  });
  assert.doesNotMatch(JSON.stringify(logged), /public_key|password|authorization/i);
});

test("falha do audit de intenção bloqueia POST antes da rede", async () => {
  const sequence = [];
  await assert.rejects(
    dispatchQuizProjectWithAudit({
      action: "funnel_provision",
      capability: "mutate",
      requireAccessImpl: async () => { sequence.push("authorized"); return { id: "clerk_1", email: "operator@example.test" }; },
      intentLogActionImpl: async () => { sequence.push("intent"); throw new Error("audit database unavailable"); },
      operationImpl: async () => { sequence.push("upstream-post"); return { kind: "success", receivedAt: "now", data: {} }; },
      logActionImpl: async () => { sequence.push("receipt"); },
    }),
    /audit database unavailable/,
  );
  assert.deepEqual(sequence, ["authorized", "intent"]);
});

test("intenção durável vem antes do POST e recibo vem depois do resultado", async () => {
  const sequence = [];
  const result = await dispatchQuizProjectWithAudit({
    action: "funnel_provision",
    capability: "mutate",
    requireAccessImpl: async () => { sequence.push("authorized"); return { id: "clerk_1", email: "operator@example.test" }; },
    intentLogActionImpl: async (entry) => { sequence.push(`intent:${entry.action}`); },
    operationImpl: async () => { sequence.push("upstream-post"); return { kind: "success", receivedAt: "now", data: { project: { projectId: "gelatina-bariatrica" } } }; },
    logActionImpl: async (entry) => { sequence.push(`receipt:${entry.action}:${entry.result}`); },
    intentTargetRefOf: () => "provision",
    targetRefOf: (_actor, operation) => operation.data.project.projectId,
  });
  assert.equal(result.kind, "success");
  assert.deepEqual(sequence, [
    "authorized",
    "intent:funnel_provision_intent",
    "upstream-post",
    "receipt:funnel_provision:success",
  ]);
});

test("vínculo Banco existente passa; inexistente para antes de intent e POST", async () => {
  assert.equal(
    await validateBancoOfferTrackingLink({ bancoOfferTrackingId: 83 }, async (id) => id === 83),
    null,
  );
  assert.deepEqual(
    await validateBancoOfferTrackingLink({ bancoOfferTrackingId: 999 }, async () => false),
    { kind: "error", code: "BANCO_OFFER_NOT_FOUND", receivedAt: null, data: null },
  );

  const sequence = [];
  const result = await dispatchQuizProjectWithAudit({
    action: "funnel_provision",
    capability: "mutate",
    requireAccessImpl: async () => { sequence.push("authorized"); return { id: "clerk_1", email: "operator@example.test" }; },
    preflightImpl: async () => {
      sequence.push("lookup");
      return validateBancoOfferTrackingLink({ bancoOfferTrackingId: 999 }, async () => false);
    },
    intentLogActionImpl: async () => { sequence.push("intent"); },
    operationImpl: async () => { sequence.push("upstream-post"); return { kind: "success", receivedAt: "now", data: {} }; },
    logActionImpl: async (entry) => { sequence.push(`receipt:${entry.resultDetail}`); },
  });
  assert.equal(result.code, "BANCO_OFFER_NOT_FOUND");
  assert.deepEqual(sequence, ["authorized", "lookup", "receipt:BANCO_OFFER_NOT_FOUND"]);
});
