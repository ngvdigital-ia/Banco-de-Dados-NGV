import assert from "node:assert/strict";
import test from "node:test";
import { dispatchQuizProjectWithAudit } from "../src/lib/sistemas/quiz/projects-dispatch.mjs";

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
