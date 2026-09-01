import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-utmify/route.ts", import.meta.url);
const VERCEL_CONFIG_PATH = new URL("../vercel.json", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("cron UTMify não está mais agendado no Vercel", async () => {
  const config = JSON.parse(await readFile(VERCEL_CONFIG_PATH, "utf8"));
  assert.ok(Array.isArray(config.crons));
  assert.equal(
    config.crons.some((cron) => cron.path === "/api/cron/sync-utmify"),
    false,
  );
});

test("rota preserva autenticação fail-closed antes de responder desativada", async () => {
  const src = await source();
  const guard = "if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {";
  const guardIndex = src.indexOf(guard);
  const responseIndex = src.indexOf("UTMIFY_CRON_DISABLED");
  assert.ok(guardIndex >= 0, "a rota deve manter a guarda CRON_SECRET");
  assert.ok(responseIndex > guardIndex, "a resposta desativada só vem após autenticar");
  assert.match(src, /status: 401/);
});

test("rota autorizada falha fechada com handoff sanitizado para o importador admin", async () => {
  const src = await source();
  assert.match(src, /success: false/);
  assert.match(src, /code: "UTMIFY_CRON_DISABLED"/);
  assert.match(src, /path: "\/api\/admin\/sync-utmify-daily"/);
  assert.match(src, /method: "POST"/);
  assert.match(src, /status: 410/);
});

test("rota desativada não importa cliente externo, banco, schema ou mapeamentos", async () => {
  const src = await source();
  assert.doesNotMatch(src, /from "@\/db(?:\/schema)?"/);
  assert.doesNotMatch(src, /from "@\/lib\/utmify"/);
  assert.doesNotMatch(src, /from "@\/lib\/offer-mappings"/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /\bdb\s*\./);
  assert.doesNotMatch(src, /metricsSnapshots/);
});
