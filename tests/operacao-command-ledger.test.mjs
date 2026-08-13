import assert from "node:assert/strict";
import test from "node:test";
import {
  IDEMPOTENCY_CONFLICT,
  IDEMPOTENCY_NEW,
  IDEMPOTENCY_REPLAY,
  canonicalJson,
  classifyIdempotency,
  commandDigest,
  detectSensitivePayload,
  sanitizeCommandId,
  sha256Hex,
} from "../src/lib/operacao/command-ledger.mjs";

test("canonicalJson é determinístico e ordena chaves recursivamente", () => {
  const object = { z: 1, a: { n: 3, m: [2, 1, { b: 1, a: 2 }], l: null }, k: "x" };
  const canonical = canonicalJson(object);
  assert.equal(canonical, canonicalJson(object));
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(
    canonicalJson({ list: [{ y: 1, x: 2 }, { b: 1, a: 3 }] }),
    canonicalJson({ list: [{ x: 2, y: 1 }, { a: 3, b: 1 }] }),
  );
  assert.equal(canonicalJson(undefined), "null");
  assert.deepEqual(JSON.parse(canonical), object);
});

test("sha256Hex e commandDigest são determinísticos e sensíveis ao conteúdo", () => {
  assert.equal(sha256Hex("abc"), sha256Hex("abc"));
  assert.equal(sha256Hex("abc").length, 64);
  assert.match(sha256Hex("abc"), /^[0-9a-f]{64}$/);
  assert.notEqual(sha256Hex("abc"), sha256Hex("abd"));

  const command = {
    schema_version: 1,
    command_id: "cmd-x",
    offer_id: "ngv:calistenia-21d",
    actor: { name: "Diogo", clickup_user_id: 102680936 },
    action: "comment",
    requested_at: "2026-08-11T18:00:00-03:00",
    args: { task_id: "86ajm207a", body: "x" },
  };
  const reordered = JSON.parse(JSON.stringify(command));
  reordered.actor.clickup_user_id = 102680936;
  reordered.args = { body: "x", task_id: "86ajm207a" };
  assert.equal(commandDigest(command), commandDigest(reordered));
  assert.equal(commandDigest(command).length, 64);
  assert.match(commandDigest(command), /^[0-9a-f]{64}$/);
});

test("commandDigest difere quando qualquer campo do payload muda", () => {
  const base = {
    schema_version: 1,
    command_id: "cmd-y",
    offer_id: "ngv:calistenia-21d",
    actor: { name: "Diogo", clickup_user_id: 102680936 },
    action: "comment",
    requested_at: "2026-08-11T18:00:00-03:00",
    approval: { required: true, approved: true, by: "Diogo" },
    risk: { level: "low", summary: "s" },
    precondition: { optimistic_date_updated: "2026-08-11T17:55:00-03:00" },
    args: { task_id: "86ajm207a", body: "texto" },
  };
  const mutate = (patch) => commandDigest({ ...base, ...patch });
  const original = commandDigest(base);
  assert.notEqual(original, mutate({ command_id: "cmd-z" }));
  assert.notEqual(original, mutate({ action: "edit" }));
  assert.notEqual(original, mutate({ args: { ...base.args, body: "outro" } }));
  assert.notEqual(original, mutate({ actor: { ...base.actor, name: "Pedro" } }));
  assert.equal(mutate({ requested_at: "2026-08-11T18:00:00-03:00" }), original);
});

test("idempotência usa o payload canônico inteiro: due_at alterado gera conflict no mesmo command_id", () => {
  const base = {
    schema_version: 1,
    command_id: "cmd-due-at",
    offer_id: "ngv:calistenia-21d",
    actor: { name: "Diogo", clickup_user_id: 102680936 },
    action: "edit",
    requested_at: "2026-08-11T18:00:00-03:00",
    args: { task_id: "86ajm207a", due_at: "2026-08-20T12:00:00-03:00" },
  };
  const changed = {
    ...base,
    args: { ...base.args, due_at: "2026-08-21T12:00:00-03:00" },
  };
  assert.equal(changed.command_id, base.command_id);
  const existingHash = commandDigest(base);
  const incomingHash = commandDigest(changed);
  assert.notEqual(incomingHash, existingHash);
  assert.equal(
    classifyIdempotency({ existingHash, incomingHash }),
    IDEMPOTENCY_CONFLICT,
  );
});

test("classifyIdempotency retorna new para hash ausente e replay/conflict por igualdade", () => {
  const digest = sha256Hex("payload");
  assert.equal(classifyIdempotency({ existingHash: undefined, incomingHash: digest }), IDEMPOTENCY_NEW);
  assert.equal(classifyIdempotency({ existingHash: null, incomingHash: digest }), "new");
  assert.equal(classifyIdempotency({ existingHash: digest, incomingHash: digest }), IDEMPOTENCY_REPLAY);
  assert.equal(classifyIdempotency({ existingHash: sha256Hex("outro"), incomingHash: digest }), IDEMPOTENCY_CONFLICT);
});

test("detectSensitivePayload sinaliza chaves sensíveis por padrão (token, secret, password, apikey)", () => {
  const cases = [
    { token: "abc" },
    { secret: "abc" },
    { password: "abc" },
    { api_key: "abc" },
    { apiKey: "abc" },
    { access_key: "abc" },
    { client_secret: "abc" },
    { authorization: "Bearer abc" },
    { cookie: "sid=1" },
    { credential: "abc" },
  ];
  for (const command of cases) {
    const found = detectSensitivePayload(command);
    assert.equal(found.sensitive, true, `chave sensível não detectada: ${JSON.stringify(command)}`);
    assert.ok(found.matches.length >= 1);
  }
  assert.equal(detectSensitivePayload({ task_id: "86ajm207a", body: "texto comum" }).sensitive, false);
});

test("detectSensitivePayload detecta valores de token sem ecoar o valor", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const aws = "AKIA1234567890ABCDEF";
  const slack = "xoxb-1234567890-abcdefghij";
  const github = "ghp_" + "x".repeat(36);
  const openai = "sk-" + "x".repeat(24);
  const hex64 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const privateKey = "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----";

  const cases = [
    { authorization: `Bearer ${jwt}` },
    { args: { task_id: "x", body: jwt } },
    { args: { access_key: aws } },
    { token: slack },
    { secret: github },
    { api_key: openai },
    { cookie: "session=" + hex64 },
    { payload: privateKey },
  ];
  for (const command of cases) {
    const found = detectSensitivePayload(command);
    const serialized = JSON.stringify(found);
    assert.equal(found.sensitive, true, `valor token não detectado: ${JSON.stringify(command)}`);
    assert.equal(serialized.includes(jwt), false);
    assert.equal(serialized.includes(aws), false);
    assert.equal(serialized.includes(slack), false);
    assert.equal(serialized.includes(github), false);
    assert.equal(serialized.includes(openai), false);
    assert.equal(serialized.includes(hex64), false);
    assert.equal(serialized.includes("MII"), false);
    for (const match of found.matches) {
      assert.equal(typeof match, "string");
      assert.match(match, /^[^:]+:[^:]+$/);
    }
  }
});

test("detectSensitivePayload limita a 10 achados e nunca expõe o valor real", () => {
  const command = {
    token: "sk-secret-1",
    api_key: "sk-secret-2",
    password: "sk-secret-3",
    client_secret: "sk-secret-4",
    authorization: "Bearer eyJ.".repeat(20),
    cookie: "sid=1",
    args: { task_id: "x", body: "normal" },
  };
  const found = detectSensitivePayload(command);
  assert.equal(found.sensitive, true);
  assert.ok(found.matches.length <= 10);
  const serialized = JSON.stringify(found);
  for (const value of ["sk-secret-1", "sk-secret-2", "sk-secret-3", "sk-secret-4", "eyJ."]) {
    assert.equal(serialized.includes(value), false, `valor vazou: ${value}`);
  }
});

test("sanitizeCommandId mantém charset permitido, limita 128 e cai para unknown", () => {
  assert.equal(sanitizeCommandId("cmd-ngv-calistenia-consult-001"), "cmd-ngv-calistenia-consult-001");
  assert.equal(sanitizeCommandId("cmd.with.dot:ok"), "cmd.with.dot:ok");
  assert.equal(sanitizeCommandId("ruim espaco"), "ruim_espaco");
  assert.equal(sanitizeCommandId("a".repeat(200)).length, 128);
  assert.equal(sanitizeCommandId(""), "unknown");
  assert.equal(sanitizeCommandId(null), "unknown");
  assert.equal(sanitizeCommandId(undefined), "unknown");
  assert.equal(sanitizeCommandId(42), "unknown");
});
