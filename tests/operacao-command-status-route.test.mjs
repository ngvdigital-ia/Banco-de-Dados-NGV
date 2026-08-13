import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { displayStateForOutbox } from "../src/lib/operacao/command-status.mjs";

const ROUTE_PATH = new URL("../src/app/api/operacao/commands/[commandId]/status/route.ts", import.meta.url);
const FEATURE_PATH = new URL("../src/lib/operacao/feature.ts", import.meta.url);
const routeSource = () => readFile(ROUTE_PATH, "utf8");

test("rota exige as duas flags antes de auth e fetch", async () => {
  const source = await routeSource();
  const guard = source.indexOf("if (!isOperationCommandsEnabled || !isOperationCommandStatusEnabled)");
  const auth = source.indexOf("await requireOperationOperator()");
  const fetch = source.indexOf("await fetchOperationCommandStatus(commandId)");
  assert.ok(guard >= 0 && auth > guard && fetch > auth);
});

test("flags são server-side, runtime/dynamic e cache são seguros", async () => {
  const feature = await readFile(FEATURE_PATH, "utf8");
  const source = await routeSource();
  assert.match(feature, /isOperationCommandStatusEnabled\s*=\s*\n\s*typeof window === ["']undefined["']/);
  assert.match(feature, /process\.env\.OPERATION_COMMAND_STATUS_ENABLED === ["']true["']/);
  assert.match(source, /export const runtime = ["']nodejs["'];/);
  assert.match(source, /export const dynamic = ["']force-dynamic["'];/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.match(source, /\{ params \}: \{ params: Promise<\{ commandId: string \}> \}/);
});

test("rota não importa DB e deixa a validação do commandId no cliente existente", async () => {
  const source = await routeSource();
  assert.doesNotMatch(source, /@\/db/);
  assert.doesNotMatch(source, /new RegExp|\.match\(/);
  assert.match(source, /fetchOperationCommandStatus\(commandId\)/);
});

test("todos os estados projetam display_state sem alterar completed", () => {
  const states = {
    queued: "queued",
    leased: "queued",
    running: "running",
    ready_for_review: "waiting_human",
    waiting_human: "waiting_human",
    failed: "failed",
    completed: "succeeded_candidate",
  };
  for (const [state, display] of Object.entries(states)) assert.equal(displayStateForOutbox(state), display);
  assert.equal(displayStateForOutbox("unknown"), null);
});

test("mapeamentos de erro não ecoam segredo remoto", async () => {
  const source = await routeSource();
  assert.match(source, /COMMAND_ID_INVALID/);
  assert.match(source, /INVALID_COMMAND_ID/);
  assert.match(source, /STATUS_AUTH_FAILED/);
  assert.match(source, /RESPONSE_ENVELOPE_MISMATCH/);
  assert.match(source, /return response\(\{ error: "STATUS_UNAVAILABLE" \}, remoteFailureStatus\(code\)\)/);
  assert.doesNotMatch(source, /error\.message|JSON\.stringify\(error\)/);
  assert.match(source, /result\.kind === "not_found"/);
  assert.match(source, /result\.kind === "disabled"/);
  assert.match(source, /response\(\{ error: "INVALID_COMMAND_ID" \}, 400\)/);
});
