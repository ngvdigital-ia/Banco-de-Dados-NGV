import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { OPERATION_OPERATOR_EMAILS, isOperationOperator } from "../src/lib/operacao/authz-core.mjs";

const PAGE_PATH = new URL("../src/app/(dashboard)/operacao/page.tsx", import.meta.url);
const ADMIN_EMAILS_PATH = new URL("../src/lib/admin-emails.ts", import.meta.url);
const AUTHZ_PATH = new URL("../src/lib/operacao/authz.ts", import.meta.url);

test("allowlist operacional aceita exatamente Pedro e Diogo documentados", () => {
  assert.deepEqual([...OPERATION_OPERATOR_EMAILS], [
    "ngvdigital.ia@gmail.com",
    "ngvdigital10@gmail.com",
  ]);
  assert.equal(isOperationOperator("NGVDIGITAL.IA@GMAIL.COM"), true);
  assert.equal(isOperationOperator("NGVDIGITAL10@GMAIL.COM"), true);
  assert.equal(isOperationOperator("outro@example.com"), false);
  assert.equal(isOperationOperator(null), false);
});

test("allowlist operacional não amplia ADMIN_EMAILS global", async () => {
  const source = await readFile(ADMIN_EMAILS_PATH, "utf8");
  assert.match(source, /ngvdigital\.ia@gmail\.com/);
  assert.doesNotMatch(source, /ngvdigital10@gmail\.com/);
});

test("/operacao aplica flag, guard e snapshot nessa ordem, sem operação mutável", async () => {
  const [source, authz] = await Promise.all([readFile(PAGE_PATH, "utf8"), readFile(AUTHZ_PATH, "utf8")]);
  const flag = source.indexOf("if (!isOperationCockpitEnabled)");
  const guard = source.indexOf("await requireOperationOperator()");
  const snapshot = source.indexOf("const result = await readOperationSnapshot()");

  assert.ok(flag >= 0);
  assert.ok(guard > flag);
  assert.ok(snapshot > guard);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(source, /use server/);
  assert.doesNotMatch(source, /ngvdigital10@gmail\.com|ngvdigital\.ia@gmail\.com/);
  assert.match(authz, /getCurrentUser/);
  assert.match(authz, /AdminAuthError/);
  assert.match(authz, /requireOperationOperator/);
});
