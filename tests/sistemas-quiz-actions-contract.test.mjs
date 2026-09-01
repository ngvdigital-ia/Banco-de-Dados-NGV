import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ACTIONS_PATH = new URL("../src/app/(dashboard)/sistemas/quiz/actions.ts", import.meta.url);
const SERVER_WRAPPER_PATH = new URL("../src/lib/sistemas/quiz/projects.ts", import.meta.url);
const AUDIT_PATH = new URL("../src/lib/sistemas/audit.ts", import.meta.url);

test("Server Actions usam FormData, Zod, capability mutate e wrapper server-only", async () => {
  const [actions, wrapper, audit] = await Promise.all([readFile(ACTIONS_PATH, "utf8"), readFile(SERVER_WRAPPER_PATH, "utf8"), readFile(AUDIT_PATH, "utf8")]);
  assert.match(actions, /^"use server";/);
  assert.match(actions, /formData: FormData/);
  assert.match(actions, /createFunnelSchema\.safeParse/);
  assert.match(actions, /capability: "mutate"/);
  assert.match(actions, /capability: "read"/);
  assert.match(actions, /logModuleAction/);
  assert.match(actions, /recordModuleAction/);
  assert.match(actions, /intentLogActionImpl: recordModuleAction/);
  assert.match(actions, /validateBancoOfferTrackingLink/);
  assert.match(actions, /\.select\(\{ id: offerTracking\.id \}\)/);
  assert.match(actions, /\.from\(offerTracking\)/);
  assert.match(actions, /\.limit\(1\)/);
  assert.match(actions, /revalidatePath\(QUIZ_PATH\)/);
  assert.match(wrapper, /import "server-only"/);
  assert.match(wrapper, /process\.env\.QUIZ_DASHBOARD_USERNAME/);
  assert.match(wrapper, /process\.env\.QUIZ_DASHBOARD_PASSWORD/);
  assert.match(audit, /export async function recordModuleAction/);
  assert.match(audit, /await db\.insert\(moduleActionLog\)\.values/);
});
