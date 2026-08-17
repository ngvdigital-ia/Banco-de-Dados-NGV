import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-clickup/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("rota importa a decisão pura de shouldReplaceSnapshots do módulo de guards", async () => {
  const src = await source();
  assert.match(
    src,
    /import \{ shouldReplaceSnapshots \} from ["']@\/lib\/cron\/sync-clickup-guards\.mjs["']/,
  );
});

test("delete de clickup_task só roda dentro de if (doneSyncOk) — nunca incondicional", async () => {
  const src = await source();
  const declIdx = src.indexOf("const doneSyncOk = shouldReplaceSnapshots(results);");
  const deleteIdx = src.indexOf(
    'await db.delete(metricsSnapshots).where(eq(metricsSnapshots.entityType, "clickup_task"));',
  );
  assert.ok(declIdx >= 0, "doneSyncOk deve ser calculado a partir de results");
  assert.ok(deleteIdx > declIdx, "delete de clickup_task deve vir depois do cálculo de doneSyncOk");

  // A guarda precisa envolver o delete: entre a declaração de doneSyncOk e o delete só
  // pode haver o `if (doneSyncOk) {` abrindo o bloco — nenhum outro delete de clickup_task
  // sem guarda deve existir no arquivo.
  const between = src.slice(declIdx, deleteIdx);
  assert.match(between, /if\s*\(doneSyncOk\)\s*\{/);
  assert.equal(
    (src.match(/db\.delete\(metricsSnapshots\)\.where\(eq\(metricsSnapshots\.entityType, ["']clickup_task["']\)\)/g) ?? []).length,
    1,
    "só deve existir 1 delete de clickup_task no arquivo inteiro",
  );
});

test("delete de clickup_open_task só roda dentro de if (openSyncOk) — nunca incondicional", async () => {
  const src = await source();
  const declIdx = src.indexOf("const openSyncOk = shouldReplaceSnapshots(openResults);");
  const deleteIdx = src.indexOf(
    'await db.delete(metricsSnapshots).where(eq(metricsSnapshots.entityType, "clickup_open_task"));',
  );
  assert.ok(declIdx >= 0, "openSyncOk deve ser calculado a partir de openResults");
  assert.ok(deleteIdx > declIdx, "delete de clickup_open_task deve vir depois do cálculo de openSyncOk");

  const between = src.slice(declIdx, deleteIdx);
  assert.match(between, /if\s*\(openSyncOk\)\s*\{/);
  assert.equal(
    (src.match(/db\.delete\(metricsSnapshots\)\.where\(eq\(metricsSnapshots\.entityType, ["']clickup_open_task["']\)\)/g) ?? []).length,
    1,
    "só deve existir 1 delete de clickup_open_task no arquivo inteiro",
  );
});

test("success da resposta é derivado de doneSyncOk/openSyncOk, nunca fixo em true", async () => {
  const src = await source();
  assert.match(src, /success: doneSyncOk \|\| openSyncOk,/);
  // Não pode sobrar nenhum "success: true," fixo no corpo da resposta desta rota.
  assert.doesNotMatch(src, /success: true,/);
});

test("os dois deletes continuam no total 2 no arquivo (nenhum terceiro delete surgiu)", async () => {
  const src = await source();
  assert.equal((src.match(/await db\.delete\(/g) ?? []).length, 2);
});
