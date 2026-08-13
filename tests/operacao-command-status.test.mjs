import assert from "node:assert/strict";
import test from "node:test";
import { COMMAND_STATUS_PATH, decideStatusReconciliation, fetchOperationCommandStatus, MAX_COMMAND_STATUS_RESULT_BYTES } from "../src/lib/operacao/command-status.mjs";

const commandId = "cmd.status-1";
const config = { enabled: true, url: `https://status.example.test${COMMAND_STATUS_PATH}`, secret: "status-secret", hostAllowlist: ["status.example.test"] };
const jobId = "a".repeat(64);
const stream = (value) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(value))); c.close(); } });
const success = (extra = {}) => ({ ok: true, http_status: 200, code: "OPERATION_COMMAND_RESULT", operation_command_result: { command_id: commandId, job_id: jobId, action: "consult", outbox_state: "completed", result: { answer: "ok" }, sanitized_error: null, lease_generation: 2, updated_at: "2026-08-11T12:00:00.000Z", completed_at: "2026-08-11T12:01:00.000Z", ...extra } });
const response = (body, status = 200) => new Response(stream(body), { status });

test("env vazio mantém cliente dormente", async () => assert.equal((await fetchOperationCommandStatus(commandId, { config: { enabled: false } })).kind, "disabled"));
test("flag fail-closed só habilita boolean true ou string true", async () => {
  let calls = 0;
  for (const enabled of ["", 0, "FALSE", "lixo"]) {
    const result = await fetchOperationCommandStatus(commandId, { config: { enabled, url: "not-a-url", hostAllowlist: "", secret: "" }, fetchImpl: async () => { calls += 1; return response(success()); } });
    assert.deepEqual(result, { kind: "disabled", ok: false, code: "STATUS_DISABLED" });
  }
  assert.equal(calls, 0);
  assert.equal((await fetchOperationCommandStatus(commandId, { config: { ...config, enabled: true }, fetchImpl: async () => response(success()) })).kind, "success");
  assert.equal((await fetchOperationCommandStatus(commandId, { config: { ...config, enabled: "true" }, fetchImpl: async () => response(success()) })).kind, "success");
});
test("POST exato, auth, body estrito e redirect:error", async () => {
  let captured;
  const result = await fetchOperationCommandStatus(commandId, { config, fetchImpl: async (url, init) => { captured = { url, init }; return response(success()); } });
  assert.equal(result.kind, "success"); assert.equal(captured.url.toString(), config.url); assert.equal(captured.init.method, "POST"); assert.equal(captured.init.redirect, "error"); assert.equal(captured.init.headers["x-operation-status-secret"], config.secret); assert.deepEqual(JSON.parse(captured.init.body), { schema_version: 1, command_id: commandId });
});
test("URL, allowlist, redirect, timeout e stream-only", async () => {
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config: { ...config, url: "http://status.example.test" } }), { code: "STATUS_URL_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config: { ...config, url: `https://status.example.test:8443${COMMAND_STATUS_PATH}` } }), { code: "STATUS_URL_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config: { ...config, hostAllowlist: ["other.test"] } }), { code: "STATUS_HOST_NOT_ALLOWLISTED" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config: { ...config, timeoutMs: 1 }, fetchImpl: (_u, i) => new Promise((_, reject) => i.signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))) }), { code: "STATUS_TIMEOUT" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => new Response("{}") }), { code: "RESPONSE_ENVELOPE_INVALID" });
});
test("tamanho de resposta, auth/invalid sem detalhe remoto e transport wrapper", async () => {
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ result: { x: "x".repeat(MAX_COMMAND_STATUS_RESULT_BYTES) } })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response({ remote_secret: "do-not-leak" }, 401) }), { code: "STATUS_AUTH_FAILED" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response({ remote_secret: "do-not-leak" }, 422) }), { code: "STATUS_REQUEST_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success(), 201) }), { code: "RESPONSE_TRANSPORT_MISMATCH" });
});
test("sucesso, not found, mismatch e estados inválidos", async () => {
  assert.equal((await fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success()) })).operation_command_result.command_id, commandId);
  const notFound = await fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response({ ok: false, http_status: 404, code: "COMMAND_NOT_FOUND", operation_command_result: null }, 404) }); assert.equal(notFound.kind, "not_found");
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ command_id: "other" })) }), { code: "RESPONSE_ENVELOPE_MISMATCH" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ outbox_state: "bogus" })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ sanitized_error: "Bearer abc" })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ result: { safe: { nested: { token: "do-not-echo" } } } })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  let deep = "leaf";
  for (let index = 0; index < 10; index += 1) deep = { [`level_${index}`]: deep };
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ result: deep })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  const tooManyNodes = Object.fromEntries(Array.from({ length: 2001 }, (_, index) => [`node_${index}`, 1]));
  assert.ok(new TextEncoder().encode(JSON.stringify(tooManyNodes)).byteLength < 32 * 1024);
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ result: tooManyNodes })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ updated_at: "2026-08-11T12:00:00" })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
  await assert.rejects(() => fetchOperationCommandStatus(commandId, { config, fetchImpl: async () => response(success({ completed_at: "2026-08-11T12:01:00" })) }), { code: "RESPONSE_ENVELOPE_INVALID" });
});

test("workflow 14: aceita envelope direto de sucesso e preserva outbox_state e resultado", async () => {
  const workflow14Result = {
    command_id: commandId,
    job_id: "b".repeat(64),
    action: "consult",
    outbox_state: "completed",
    result: { source: "workflow-14", items: [{ id: "offer-1", status: "ready" }] },
    sanitized_error: null,
    lease_generation: 7,
    updated_at: "2026-08-12T14:00:00.000Z",
    completed_at: "2026-08-12T14:00:01.000Z",
  };
  const received = await fetchOperationCommandStatus(commandId, {
    config,
    fetchImpl: async () => response({
      ok: true,
      http_status: 200,
      code: "OPERATION_COMMAND_RESULT",
      operation_command_result: workflow14Result,
    }),
  });

  assert.equal(received.kind, "success");
  assert.equal(received.operation_command_result.command_id, commandId);
  assert.equal(received.operation_command_result.outbox_state, "completed");
  assert.deepEqual(received.operation_command_result, workflow14Result);
});

test("workflow 14: COMMAND_NOT_FOUND retorna not_found sem inventar resultado interno", async () => {
  const received = await fetchOperationCommandStatus(commandId, {
    config,
    fetchImpl: async () => response({
      ok: false,
      http_status: 404,
      code: "COMMAND_NOT_FOUND",
      operation_command_result: null,
    }, 404),
  });

  assert.deepEqual(received, {
    kind: "not_found",
    ok: false,
    http_status: 404,
    code: "COMMAND_NOT_FOUND",
    operation_command_result: null,
  });
});

const states = ["queued", "leased", "running", "ready_for_review", "waiting_human", "failed", "completed"];
test("mapeia todos os estados e preserva outbox_state bruto", () => {
  const expected = ["queued", "queued", "running", "waiting_human", "waiting_human", "failed", "succeeded_candidate"];
  for (const [index, state] of states.entries()) { const result = decideStatusReconciliation({ outbox_state: "queued", lease_generation: 1, updated_at: "2026-08-11T11:00:00.000Z" }, { outbox_state: state, lease_generation: 2, updated_at: "2026-08-11T12:00:00.000Z" }); assert.equal(result.decision, "apply"); assert.equal(result.display_state, expected[index]); assert.equal(result.outbox_state, state); }
});
test("reconciliação monotônica, terminal e sem mutação", () => {
  const previous = { outbox_state: "ready_for_review", lease_generation: 3, updated_at: "2026-08-11T12:00:00.000Z" }; const incoming = { outbox_state: "failed", lease_generation: 4, updated_at: "2026-08-11T13:00:00.000Z" }; const before = structuredClone(previous); const result = decideStatusReconciliation(previous, incoming); assert.equal(result.decision, "terminal_conflict"); assert.deepEqual(previous, before);
  assert.equal(decideStatusReconciliation({ outbox_state: "running", lease_generation: 4, updated_at: "2026-08-11T12:00:00.000Z" }, { outbox_state: "completed", lease_generation: 3, updated_at: "2026-08-11T13:00:00.000Z" }).decision, "stale");
  assert.equal(decideStatusReconciliation({ outbox_state: "running", lease_generation: 4, updated_at: "2026-08-11T12:00:00.000Z" }, { outbox_state: "running", lease_generation: 4, updated_at: "2026-08-11T12:00:00.000Z" }).decision, "stale");
  assert.equal(decideStatusReconciliation(null, { outbox_state: "running", lease_generation: 1, updated_at: "2026-08-11T12:00:00.000Z" }).decision, "terminal_conflict");
  assert.equal(decideStatusReconciliation({ outbox_state: "running", lease_generation: 1, updated_at: "2026-08-11T12:00:00.000Z" }, null).decision, "terminal_conflict");
});
