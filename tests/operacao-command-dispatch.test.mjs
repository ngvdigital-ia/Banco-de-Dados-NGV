import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { canonicalJson, commandDigest } from "../src/lib/operacao/command-ledger.mjs";
import {
  MAX_COMMAND_REQUEST_BYTES,
  MAX_COMMAND_RESPONSE_BYTES,
  dispatchOperationCommand,
} from "../src/lib/operacao/command-dispatch.mjs";

const command = {
  schema_version: 1,
  command_id: "cmd-adapter-1",
  offer_id: "ngv:demo",
  actor: { name: "Operator", clickup_user_id: 42 },
  action: "consult",
  requested_at: "2026-08-11T12:00:00.000Z",
  args: { task_id: "task-1" },
};

const config = {
  url: "https://intake.example.test/webhook/codex-operation/command",
  secret: "test-secret",
  hostAllowlist: ["intake.example.test"],
};

const jobId = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function streamJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function envelope(httpStatus, accepted, code, extra = {}) {
  return {
    http_status: httpStatus,
    accepted,
    code,
    returned_command_id: command.command_id,
    returned_payload_hash: commandDigest(command),
    ...extra,
  };
}

function responseFor(httpStatus, accepted, code, extra = {}, transport = 200) {
  return new Response(streamJson(envelope(httpStatus, accepted, code, extra)), { status: transport });
}

test("URL válida é aceita e usa envelope direto", async () => {
  const receipt = await dispatchOperationCommand(command, {
    config,
    fetchImpl: async () => responseFor(202, true, "ENQUEUED"),
  });
  assert.equal(receipt.http_status, 202);
});

test("assina os bytes canônicos com HMAC SHA256 hexadecimal puro", async () => {
  let captured;
  const body = canonicalJson(command);
  await dispatchOperationCommand(command, {
    config,
    fetchImpl: async (_url, init) => {
      captured = init;
      return responseFor(202, true, "ENQUEUED");
    },
  });
  const expected = createHmac("sha256", config.secret).update(new TextEncoder().encode(body)).digest("hex");
  assert.equal(captured.body, body);
  assert.equal(captured.headers["x-signature"], expected);
  assert.match(captured.headers["x-signature"], /^[0-9a-f]{64}$/);
});

test("rejeita HTTP, userinfo, query, hash, pathname incorreto e host fora da allowlist", async () => {
  const fetchImpl = async () => responseFor(202, true, "ENQUEUED");
  const invalidUrls = [
    "http://intake.example.test/webhook/codex-operation/command",
    "https://user:pass@intake.example.test/webhook/codex-operation/command",
    "https://intake.example.test/webhook/codex-operation/command?x=1",
    "https://intake.example.test/webhook/codex-operation/command#hash",
    "https://intake.example.test:8443/webhook/codex-operation/command",
    "https://intake.example.test/webhook/wrong",
  ];
  for (const url of invalidUrls) {
    await assert.rejects(
      () => dispatchOperationCommand(command, { config: { ...config, url }, fetchImpl }),
      (error) => error.code === "INTAKE_URL_INVALID",
    );
  }
  await assert.rejects(
    () => dispatchOperationCommand(command, { config: { ...config, url: "https://other.example.test/webhook/codex-operation/command" }, fetchImpl }),
    (error) => error.code === "INTAKE_HOST_NOT_ALLOWLISTED",
  );
});

test("usa redirect:error e limita timeout configurado a 5000ms", async () => {
  let captured;
  await dispatchOperationCommand(command, {
    config: { ...config, timeoutMs: 99999 },
    fetchImpl: async (_url, init) => {
      captured = init;
      return responseFor(202, true, "ENQUEUED");
    },
  });
  assert.equal(captured.redirect, "error");
  assert.ok(captured.signal instanceof AbortSignal);
});

test("aborta timeout real curto e traduz AbortError", async () => {
  await assert.rejects(
    () => dispatchOperationCommand(command, {
      config: { ...config, timeoutMs: 5 },
      fetchImpl: (_url, init) => new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      }),
    }),
    (error) => error.code === "INTAKE_TIMEOUT",
  );
});

test("rejeita request e response acima de 64KiB usando streams", async () => {
  const hugeCommand = { ...command, args: { task_id: "x".repeat(MAX_COMMAND_REQUEST_BYTES) } };
  await assert.rejects(
    () => dispatchOperationCommand(hugeCommand, { config, fetchImpl: async () => responseFor(202, true, "ENQUEUED") }),
    (error) => error.code === "REQUEST_TOO_LARGE",
  );
  await assert.rejects(
    () => dispatchOperationCommand(command, {
      config,
      fetchImpl: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(MAX_COMMAND_RESPONSE_BYTES + 1));
          controller.close();
        },
      }), { status: 200 }),
    }),
    (error) => error.code === "RESPONSE_TOO_LARGE",
  );
});

test("valida combinações de envelope e sanitiza campos opcionais", async () => {
  for (const [status, accepted, code] of [[202, true, "ENQUEUED"], [200, true, "DUPLICATE"], [409, false, "COMMAND_ID_COLLISION"]]) {
    const receipt = await dispatchOperationCommand(command, {
      config,
      fetchImpl: async () => responseFor(status, accepted, code, {
        returned_job_id: jobId,
        state: "queued",
        created_at: "2026-08-11T12:00:00.000Z",
        ignored: { secret: "not copied" },
      }),
    });
    assert.equal(receipt.http_status, status);
    assert.equal(receipt.returned_job_id, jobId);
    assert.equal(receipt.state, "queued");
    assert.equal(receipt.ignored, undefined);
  }
  await assert.rejects(
    () => dispatchOperationCommand(command, { config, fetchImpl: async () => new Response(streamJson({ ...envelope(202, true, "ENQUEUED"), returned_job_id: "job-1" }), { status: 200 }) }),
    (error) => error.code === "RESPONSE_ENVELOPE_INVALID",
  );
  await assert.rejects(
    () => dispatchOperationCommand(command, { config, fetchImpl: async () => new Response(streamJson({ ...envelope(202, true, "ENQUEUED"), state: "unknown" }), { status: 200 }) }),
    (error) => error.code === "RESPONSE_ENVELOPE_INVALID",
  );
  await assert.rejects(
    () => dispatchOperationCommand(command, { config, fetchImpl: async () => new Response(streamJson({ ...envelope(202, true, "ENQUEUED"), created_at: "2026-08-11" }), { status: 200 }) }),
    (error) => error.code === "RESPONSE_ENVELOPE_INVALID",
  );
});

test("rejeita mismatch de IDs/hash e transporte inválido", async () => {
  await assert.rejects(
    () => dispatchOperationCommand(command, { config, fetchImpl: async () => new Response(streamJson({ ...envelope(202, true, "ENQUEUED"), returned_command_id: "wrong" }), { status: 202 }) }),
    (error) => error.code === "RESPONSE_ENVELOPE_MISMATCH",
  );
  await assert.rejects(
    () => dispatchOperationCommand(command, { config, fetchImpl: async () => new Response(streamJson(envelope(202, true, "ENQUEUED")), { status: 201 }) }),
    (error) => error.code === "RESPONSE_TRANSPORT_MISMATCH",
  );
});

test("adapter lê resposta por stream, sem fallbacks de texto/buffer/json", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/lib/operacao/command-dispatch.mjs", import.meta.url), "utf8");
  assert.match(source, /body\.getReader\(\)/);
  assert.doesNotMatch(source, /response\.text\s*\(/);
  assert.doesNotMatch(source, /response\.arrayBuffer\s*\(/);
  assert.doesNotMatch(source, /response\.json\s*\(/);
});
