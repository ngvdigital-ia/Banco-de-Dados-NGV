import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MODULE_CAPABILITIES,
  hasModuleAccess,
  moduleAllowlist,
} from "../src/lib/sistemas/authz-core.mjs";
import { OPERATION_OPERATOR_EMAILS } from "../src/lib/operacao/authz-core.mjs";

const AUTHZ_PATH = new URL("../src/lib/sistemas/authz.ts", import.meta.url);
const AUDIT_PATH = new URL("../src/lib/sistemas/audit.ts", import.meta.url);
const QUIZ_PAGE_PATH = new URL("../src/app/(dashboard)/sistemas/quiz/page.tsx", import.meta.url);
const SCHEMA_PATH = new URL("../src/db/schema.ts", import.meta.url);

test("capabilities de módulo são só read e mutate — nenhuma matriz especulativa", () => {
  assert.deepEqual([...MODULE_CAPABILITIES], ["read", "mutate"]);
});

test("allowlist de read reusa exatamente os operadores de OPERATION_OPERATOR_EMAILS", () => {
  assert.deepEqual(
    [...moduleAllowlist("read")].sort(),
    OPERATION_OPERATOR_EMAILS.map((email) => email.toLowerCase()).sort(),
  );
});

test("allowlist de mutate está vazia na Fase 1 — ninguém entra até existir módulo que mute", () => {
  assert.deepEqual([...moduleAllowlist("mutate")], []);
});

test("capability desconhecida nunca concede acesso (fail-closed)", () => {
  assert.deepEqual([...moduleAllowlist("delete")], []);
  assert.equal(hasModuleAccess("ngvdigital.ia@gmail.com", "delete"), false);
});

test("hasModuleAccess NEGA quem não está na allowlist", () => {
  assert.equal(hasModuleAccess("intruso@example.com", "read"), false);
  assert.equal(hasModuleAccess("intruso@example.com", "mutate"), false);
  assert.equal(hasModuleAccess(null, "read"), false);
  assert.equal(hasModuleAccess(undefined, "read"), false);
});

test("hasModuleAccess PERMITE operador em read, mas ninguém em mutate", () => {
  for (const email of OPERATION_OPERATOR_EMAILS) {
    assert.equal(hasModuleAccess(email, "read"), true);
    assert.equal(hasModuleAccess(email.toUpperCase(), "read"), true, "case-insensitive");
    assert.equal(hasModuleAccess(email, "mutate"), false);
  }
});

test("requireModuleAccess: não-autenticado 401, sem permissão 403, mesmo formato de AdminAuthError", async () => {
  const source = await readFile(AUTHZ_PATH, "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /getCurrentUser/);
  assert.match(source, /AdminAuthError\(\s*"Não autenticado",\s*401\s*\)/);
  assert.match(source, /AdminAuthError\(/);
  assert.match(source, /403/);
  assert.match(source, /hasModuleAccess/);
});

test("audit.ts nunca persiste payload bruto — só payloadHash, sanitiza targetRef/resultDetail", async () => {
  const source = await readFile(AUDIT_PATH, "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /detectSensitivePayload/);
  assert.match(source, /commandDigest/);
  assert.match(source, /payloadHash:\s*hashPayload/);
  assert.doesNotMatch(source, /payload:\s*params\.payload/, "nunca grava o payload bruto na tabela");
});

test("module_action_log: colunas do ADR presentes, índice por module+occurred_at", async () => {
  const source = await readFile(SCHEMA_PATH, "utf8");
  assert.match(source, /export const moduleActionLog = pgTable\(\s*"module_action_log"/);
  assert.match(source, /occurredAt: timestamp\("occurred_at"/);
  assert.match(source, /actorClerkId: text\("actor_clerk_id"\)\.notNull\(\)/);
  assert.match(source, /actorEmail: text\("actor_email"\)\.notNull\(\)/);
  assert.match(source, /module: text\("module"\)\.notNull\(\)/);
  assert.match(source, /action: text\("action"\)\.notNull\(\)/);
  assert.match(source, /targetRef: text\("target_ref"\)/);
  assert.match(source, /result: text\("result"\)\.notNull\(\)/);
  assert.match(source, /resultDetail: text\("result_detail"\)/);
  assert.match(source, /payloadHash: text\("payload_hash"\)/);
  assert.match(source, /index\("module_action_log_module_idx"\)\.on\(t\.module, t\.occurredAt\)/);
});

test("/sistemas/quiz aplica o guard antes de renderizar, sem buscar dado do Quiz ainda", async () => {
  const source = await readFile(QUIZ_PAGE_PATH, "utf8");
  const guard = source.indexOf('await requireModuleAccess("quiz", "read")');
  const render = source.indexOf("return (");

  assert.ok(guard >= 0, "guard requireModuleAccess deve existir");
  assert.ok(render > guard, "render só acontece depois do guard");
  assert.doesNotMatch(source, /fetch\s*\(/, "Fase 1 não busca dado do Quiz");
  assert.doesNotMatch(source, /use server/);
});
