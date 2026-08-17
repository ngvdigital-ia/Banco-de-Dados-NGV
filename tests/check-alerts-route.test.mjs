import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/check-alerts/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("erro por alerta no laço vira entrada em evalErrors, não só console.error", async () => {
  const src = await source();
  const idx = src.indexOf('console.error(`[check-alerts] erro no alerta "${a.name}":`, err);');
  assert.ok(idx >= 0);
  const window = src.slice(idx, idx + 150);
  assert.match(window, /evalErrors\.push\(\{ name: a\.name, error: message \}\)/);
});

test("evalErrors é exposto no corpo da resposta", async () => {
  const src = await source();
  assert.match(src, /const evalErrors: \{ name: string; error: string \}\[\] = \[\];/);
  assert.match(src, /evalErrors,\s*\n\s*agentsHealth:/);
});

test("checkAgentsHealth() estourando não fica indistinguível de 'tudo saudável' (checked: false)", async () => {
  const src = await source();
  assert.match(src, /let agentsHealthChecked = true;/);
  const catchIdx = src.indexOf('console.error("[check-alerts] falha ao checar saúde dos agentes:", err);');
  assert.ok(catchIdx >= 0);
  const window = src.slice(Math.max(0, catchIdx - 200), catchIdx);
  assert.match(window, /agentsHealthChecked = false;/);
});

test("agentsHealth no corpo da resposta carrega o campo checked (e error quando houver)", async () => {
  const src = await source();
  assert.match(
    src,
    /agentsHealth: \{\s*\n\s*silentCount,\s*\n\s*checked: agentsHealthChecked,\s*\n\s*\.\.\.\(agentsHealthError \? \{ error: agentsHealthError \} : \{\}\),\s*\n\s*\},/,
  );
});

test("check-alerts continua sem 5xx — N verificações independentes, rotina segura de repetir", async () => {
  const src = await source();
  assert.doesNotMatch(src, /status: 500/);
  // único status explícito continua sendo o 401 de auth.
  assert.match(src, /status: 401/);
});

test("histórico + cooldown ainda são gravados ANTES do envio ao Slack (idempotência preservada)", async () => {
  const src = await source();
  const insertIdx = src.indexOf("await db.insert(alertHistory).values({");
  const slackIdx = src.indexOf("await sendSlackAlert(webhookUrl, {");
  assert.ok(insertIdx >= 0 && slackIdx > insertIdx);
});
