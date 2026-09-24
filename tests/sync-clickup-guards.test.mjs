import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldReplaceSnapshots,
  isCompleteSync,
} from "../src/lib/cron/sync-clickup-guards.mjs";

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

// --- Fail-closed em entrada inesperada: guarda de "posso apagar?" NUNCA pode lançar ---

test("null -> protege (false), sem lançar", () => {
  assert.doesNotThrow(() => shouldReplaceSnapshots(null));
  assert.equal(shouldReplaceSnapshots(null), false);
});

test("undefined -> protege (false), sem lançar", () => {
  assert.doesNotThrow(() => shouldReplaceSnapshots(undefined));
  assert.equal(shouldReplaceSnapshots(undefined), false);
});

test("não-array objeto solto -> protege (false), sem lançar", () => {
  assert.doesNotThrow(() => shouldReplaceSnapshots({ status: "ok" }));
  assert.equal(shouldReplaceSnapshots({ status: "ok" }), false);
});

test("não-array string -> protege (false), sem lançar", () => {
  assert.doesNotThrow(() => shouldReplaceSnapshots("ok"));
  assert.equal(shouldReplaceSnapshots("ok"), false);
});

test("array com item nulo mas com um ok real -> true (item malformado não invalida os outros)", () => {
  // Escolha deliberada: um item nulo/estranho é tratado como "não é ok" (igual a um item
  // com status="error" já era), não como motivo pra ignorar sucessos legítimos no resto do
  // array. Malformação de 1 item não é evidência de falha sistêmica das outras listas.
  assert.doesNotThrow(() => shouldReplaceSnapshots([{ status: "ok" }, null]));
  assert.equal(shouldReplaceSnapshots([{ status: "ok" }, null]), true);
  assert.doesNotThrow(() => shouldReplaceSnapshots([null, { status: "ok" }]));
  assert.equal(shouldReplaceSnapshots([null, { status: "ok" }]), true);
});

test("array só com itens nulos/malformados -> protege (false), sem lançar", () => {
  assert.doesNotThrow(() => shouldReplaceSnapshots([null, undefined, {}]));
  assert.equal(shouldReplaceSnapshots([null, undefined, {}]), false);
});

// --- isCompleteSync: troca por diff só com passada COMPLETA e NÃO-VAZIA ---

test("isCompleteSync: todas as listas ok e >=1 task -> true", () => {
  assert.equal(
    isCompleteSync([
      { status: "ok", tasksFound: 5 },
      { status: "ok", tasksFound: 0 },
    ]),
    true,
  );
});

test("isCompleteSync: qualquer lista com erro (parcial) -> false", () => {
  assert.equal(
    isCompleteSync([
      { status: "ok", tasksFound: 5 },
      { status: "error", tasksFound: 0 },
    ]),
    false,
  );
});

test("isCompleteSync: todas ok mas vazio (0 tasks) -> false", () => {
  assert.equal(
    isCompleteSync([
      { status: "ok", tasksFound: 0 },
      { status: "ok", tasksFound: 0 },
    ]),
    false,
  );
});

test("isCompleteSync: lista vazia / null / undefined -> false, sem lançar", () => {
  assert.equal(isCompleteSync([]), false);
  assert.doesNotThrow(() => isCompleteSync(null));
  assert.equal(isCompleteSync(null), false);
  assert.doesNotThrow(() => isCompleteSync(undefined));
  assert.equal(isCompleteSync(undefined), false);
});

// --- snapshotKey: par (taskId, memberId) estável ---
