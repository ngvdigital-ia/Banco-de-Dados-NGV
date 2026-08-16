import assert from "node:assert/strict";
import test from "node:test";
import { dispatchCursosPushCampaignWithAudit } from "../src/lib/sistemas/cursos/push-dispatch.mjs";

const baseParams = {
  actorClerkId: "user_abc123",
  actorEmail: "operador@ngvdigital.com.br",
  input: { title: "Nova aula", launchUrl: "/courses/skyvault" },
};

function stubLogger() {
  const calls = [];
  const logActionImpl = async (params) => {
    calls.push(params);
  };
  return { calls, logActionImpl };
}

test("logActionImpl ausente lança erro explícito — nunca dispara sem auditoria silenciosamente", async () => {
  await assert.rejects(
    () => dispatchCursosPushCampaignWithAudit({ ...baseParams, sendImpl: async () => ({ kind: "success", sentAt: "x", data: { id: "1", recipients: 1 } }) }),
    TypeError,
  );
});

test("actorClerkId/actorEmail ausentes falham fechado — nunca loga auditoria com autor vazio", async () => {
  const { logActionImpl } = stubLogger();
  await assert.rejects(
    () => dispatchCursosPushCampaignWithAudit({ ...baseParams, actorClerkId: "", logActionImpl, sendImpl: async () => ({ kind: "success", sentAt: "x", data: { id: "1", recipients: 1 } }) }),
    TypeError,
  );
  await assert.rejects(
    () => dispatchCursosPushCampaignWithAudit({ ...baseParams, actorEmail: undefined, logActionImpl, sendImpl: async () => ({ kind: "success", sentAt: "x", data: { id: "1", recipients: 1 } }) }),
    TypeError,
  );
});

test("disparo com sucesso registra auditoria com actor, module, action e targetRef=id — nunca perde o resultado", async () => {
  const { calls, logActionImpl } = stubLogger();
  const sendImpl = async (input) => {
    assert.deepEqual(input, baseParams.input, "o input recebido pelo send deve ser exatamente o que o caller passou");
    return { kind: "success", sentAt: "2026-08-16T12:00:00.000Z", data: { id: "onesignal-999", recipients: 120 } };
  };

  const result = await dispatchCursosPushCampaignWithAudit({ ...baseParams, sendImpl, logActionImpl });

  assert.equal(result.kind, "success");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    actorClerkId: "user_abc123",
    actorEmail: "operador@ngvdigital.com.br",
    module: "cursos",
    action: "push_campaign_dispatch",
    targetRef: "onesignal-999",
    result: "success",
    resultDetail: null,
    payload: baseParams.input,
  });
});

test("disparo com erro (SEND_UNAUTHORIZED) registra auditoria como failure com resultDetail=code, targetRef=null", async () => {
  const { calls, logActionImpl } = stubLogger();
  const sendImpl = async () => ({ kind: "error", code: "SEND_UNAUTHORIZED", sentAt: null, data: null });

  const result = await dispatchCursosPushCampaignWithAudit({ ...baseParams, sendImpl, logActionImpl });

  assert.equal(result.kind, "error");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    actorClerkId: "user_abc123",
    actorEmail: "operador@ngvdigital.com.br",
    module: "cursos",
    action: "push_campaign_dispatch",
    targetRef: null,
    result: "failure",
    resultDetail: "SEND_UNAUTHORIZED",
    payload: baseParams.input,
  });
});

test("disparo not_configured registra auditoria como failure com resultDetail=reason", async () => {
  const { calls, logActionImpl } = stubLogger();
  const sendImpl = async () => ({ kind: "not_configured", reason: "MISSING_CREDENTIALS", sentAt: null, data: null });

  await dispatchCursosPushCampaignWithAudit({ ...baseParams, sendImpl, logActionImpl });

  assert.equal(calls[0].result, "failure");
  assert.equal(calls[0].resultDetail, "MISSING_CREDENTIALS");
});

test("payload bruto do disparo entra no log só via 'payload' (hash é responsabilidade do audit.ts real) — nunca é omitido", async () => {
  const { calls, logActionImpl } = stubLogger();
  const sendImpl = async () => ({ kind: "success", sentAt: "x", data: { id: "1", recipients: null } });

  await dispatchCursosPushCampaignWithAudit({ ...baseParams, sendImpl, logActionImpl });

  assert.deepEqual(calls[0].payload, baseParams.input, "payload precisa chegar íntegro em quem audita — nunca undefined por omissão");
});

test("sem sendImpl, usa o adapter real (sendCursosPushCampaign) — sem secret configurado, vira not_configured e ainda audita", async () => {
  const { calls, logActionImpl } = stubLogger();
  const originalSecret = process.env.CURSOS_PUSH_ADMIN_SECRET;
  delete process.env.CURSOS_PUSH_ADMIN_SECRET;
  try {
    const result = await dispatchCursosPushCampaignWithAudit({ ...baseParams, logActionImpl });
    assert.equal(result.kind, "not_configured");
    assert.equal(calls[0].resultDetail, "MISSING_CREDENTIALS");
  } finally {
    if (originalSecret === undefined) delete process.env.CURSOS_PUSH_ADMIN_SECRET;
    else process.env.CURSOS_PUSH_ADMIN_SECRET = originalSecret;
  }
});
