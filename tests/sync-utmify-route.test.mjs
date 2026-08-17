import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-utmify/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("results carrega um sinal próprio (campaignsError) além de status/dailySnapshots", async () => {
  const src = await source();
  assert.match(src, /campaignsError\?: string;/);
});

test("falha isolada na busca de campanhas grava campaignsError (não fica indistinguível de zero campanhas hoje)", async () => {
  const src = await source();
  const catchIdx = src.indexOf('console.error("[UTMify] Daily campaign sync error:", err);');
  assert.ok(catchIdx >= 0);
  const window = src.slice(Math.max(0, catchIdx - 150), catchIdx);
  assert.match(window, /campaignsError = err instanceof Error \? err\.message : ["']Unknown error["'];/);
});

test("o item do results só carrega campaignsError quando ele de fato existe (spread condicional)", async () => {
  const src = await source();
  assert.match(
    src,
    /results\.push\(\{\s*\n\s*dashboard: dashboard\.name,\s*\n\s*status: ["']ok["'],\s*\n\s*dailySnapshots,\s*\n\s*\.\.\.\(campaignsError \? \{ campaignsError \} : \{\}\),\s*\n\s*\}\);/,
  );
});

test("success da resposta é derivado de results, nunca fixo em true", async () => {
  const src = await source();
  assert.match(src, /success: results\.some\(\(r\) => r\.status === ["']ok["']\),/);
  assert.doesNotMatch(src, /success: true,/);
});

test("falha por dashboard inteiro (fetchDashboardSummary) continua marcando status: error, distinto de campaignsError isolado", async () => {
  const src = await source();
  assert.match(
    src,
    /results\.push\(\{ dashboard: dashboard\.name, status: ["']error["'], error: message \}\);/,
  );
});
