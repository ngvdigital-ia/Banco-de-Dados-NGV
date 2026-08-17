import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-vturb/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("VTURB_API_KEY ausente responde com status 500 (não mais 200 mascarado)", async () => {
  const src = await source();
  const idx = src.indexOf('"VTURB_API_KEY not configured"');
  assert.ok(idx >= 0, "mensagem original deve continuar existindo");
  const window = src.slice(idx, idx + 150);
  assert.match(window, /status: 500/);
});

test("falha de rede (fetchPlayers/fetchEventsByPlayer) responde com status 500", async () => {
  const src = await source();
  const idx = src.indexOf("success: false, error: msg");
  assert.ok(idx >= 0, "catch-all deve continuar existindo");
  const window = src.slice(idx, idx + 100);
  assert.match(window, /status: 500/);
});

test("só existem 2 respostas com status 500 no arquivo — nenhuma outra ganhou 5xx", async () => {
  const src = await source();
  assert.equal((src.match(/status: 500/g) ?? []).length, 2);
});

test("catch por player (retry-unsafe: insert sem onConflict) continua sem virar resposta 5xx", async () => {
  const src = await source();
  const idx = src.indexOf('results.push({ player: player.name, status: "error", error: msg });');
  assert.ok(idx >= 0);
  // Nada de NextResponse nem status 5xx perto do catch por-player: ele só registra no array.
  const window = src.slice(Math.max(0, idx - 200), idx + 50);
  assert.doesNotMatch(window, /NextResponse\.json/);
});

test("gate de VTURB_API_KEY ausente dispara antes de qualquer db.insert (retry seguro, insert sem onConflict)", async () => {
  const src = await source();
  const firstInsertIdx = src.indexOf("await db.insert(metricsSnapshots).values({");
  const configGateIdx = src.indexOf('"VTURB_API_KEY not configured"');
  assert.ok(configGateIdx >= 0 && firstInsertIdx > configGateIdx, "gate de config ausente deve vir antes do insert");
});
