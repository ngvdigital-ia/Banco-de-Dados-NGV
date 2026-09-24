import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-clickup/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("rota importa as decisões puras do módulo de guards", async () => {
  const src = await source();
  assert.match(
    src,
    /import \{ shouldReplaceSnapshots, isCompleteSync \} from ["']@\/lib\/cron\/sync-clickup-guards\.mjs["']/,
  );
});

test("delete de clickup_task só roda dentro de if (isCompleteSync(results)) — nunca incondicional", async () => {
  const src = await source();
  const declIdx = src.indexOf("const doneSyncOk = shouldReplaceSnapshots(results);");
  const deleteIdx = src.indexOf(
    'db.delete(metricsSnapshots).where(eq(metricsSnapshots.entityType, "clickup_task")),',
  );
  assert.ok(declIdx >= 0, "doneSyncOk deve ser calculado a partir de results");
  assert.ok(deleteIdx > declIdx, "delete de clickup_task deve vir depois do cálculo de doneSyncOk");

  // A guarda precisa envolver o delete: entre a declaração de doneSyncOk e o delete só
  // pode haver o `if (isCompleteSync(results)) {` abrindo o bloco — nenhum outro delete de clickup_task
  // sem guarda deve existir no arquivo.
  const between = src.slice(declIdx, deleteIdx);
  assert.match(between, /if\s*\(isCompleteSync\(results\)\)\s*\{/);
  assert.equal(
    (src.match(/db\.delete\(metricsSnapshots\)\.where\(eq\(metricsSnapshots\.entityType, ["']clickup_task["']\)\)/g) ?? []).length,
    1,
    "só deve existir 1 delete de clickup_task no arquivo inteiro",
  );
});

test("delete de clickup_open_task só roda dentro de if (isCompleteSync(openResults)) — nunca incondicional", async () => {
  const src = await source();
  const declIdx = src.indexOf("const openSyncOk = shouldReplaceSnapshots(openResults);");
  const deleteIdx = src.indexOf(
    'db.delete(metricsSnapshots).where(eq(metricsSnapshots.entityType, "clickup_open_task")),',
  );
  assert.ok(declIdx >= 0, "openSyncOk deve ser calculado a partir de openResults");
  assert.ok(deleteIdx > declIdx, "delete de clickup_open_task deve vir depois do cálculo de openSyncOk");

  const between = src.slice(declIdx, deleteIdx);
  assert.match(between, /if\s*\(isCompleteSync\(openResults\)\)\s*\{/);
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

test("os dois deletes continuam no total 2 e cada troca roda num db.batch (atômica)", async () => {
  const src = await source();
  assert.equal((src.match(/db\.delete\(/g) ?? []).length, 2);
  // delete + insert soltos (await um por um) deixavam a tabela vazia se o insert falhasse.
  assert.doesNotMatch(src, /await db\.delete\(/);
  assert.doesNotMatch(src, /await db\.insert\(metricsSnapshots\)\.values\((rowsToInsert|openRowsToInsert)/);
  assert.equal((src.match(/await db\.batch\(/g) ?? []).length, 2);
});
