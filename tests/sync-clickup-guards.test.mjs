import assert from "node:assert/strict";
import test from "node:test";
import { shouldReplaceSnapshots } from "../src/lib/cron/sync-clickup-guards.mjs";

test("0 sucessos entre N listas -> não apaga (false)", () => {
  const results = [
    { list: "Copy > Produto", status: "error", tasksFound: 0, error: "401" },
    { list: "Copy > Copy", status: "error", tasksFound: 0, error: "401" },
    { list: "Dev > Sites", status: "error", tasksFound: 0, error: "401" },
  ];
  assert.equal(shouldReplaceSnapshots(results), false);
});

test("lista vazia (nenhuma lista sequer rodou) -> não apaga (false)", () => {
  assert.equal(shouldReplaceSnapshots([]), false);
});

test(">=1 sucesso entre N listas -> apaga (true)", () => {
  const results = [
    { list: "Copy > Produto", status: "error", tasksFound: 0, error: "401" },
    { list: "Copy > Copy", status: "ok", tasksFound: 12 },
    { list: "Dev > Sites", status: "error", tasksFound: 0, error: "timeout" },
  ];
  assert.equal(shouldReplaceSnapshots(results), true);
});

test("todas as listas com sucesso -> apaga (true)", () => {
  const results = [
    { list: "Copy > Produto", status: "ok", tasksFound: 5 },
    { list: "Copy > Copy", status: "ok", tasksFound: 0 },
  ];
  assert.equal(shouldReplaceSnapshots(results), true);
});

test("é função pura: não muta o array recebido", () => {
  const results = [{ list: "X", status: "ok", tasksFound: 1 }];
  const snapshot = JSON.stringify(results);
  shouldReplaceSnapshots(results);
  assert.equal(JSON.stringify(results), snapshot);
});
