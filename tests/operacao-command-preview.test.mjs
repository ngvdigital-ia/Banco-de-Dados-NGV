import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { OPERATION_ACTIONS, OPERATION_MUTATION_ACTIONS } from "../src/lib/operacao/command-contract.mjs";
import { createOperationCommandPreview } from "../src/lib/operacao/command-preview.mjs";

const generatedAt = "2026-08-11T18:00:00-03:00";
const offer = (offer_id = "ngv:calistenia-21d") => ({ offer_id, offer_slug: "calistenia-21d", display_name: "Calistenia 21D", external_ids: { clickup: ["clickup:86ajm207a"] } });

test("cria preview determinístico para as oito ações", () => {
  for (const action of OPERATION_ACTIONS) {
    const result = createOperationCommandPreview({ offer: offer(), action, generatedAt });
    assert.equal(result.can_submit, false);
    assert.equal(result.command.command_id, `preview:${action}:calistenia-21d`);
    assert.equal(result.command.requested_at, generatedAt);
    assert.equal(result.command.actor.name, "PENDING");
    assert.equal(result.target, "clickup:86ajm207a");
  }
});

test("consult pode validar, mas continua indisponível para envio", () => {
  const result = createOperationCommandPreview({ offer: offer(), action: "consult", generatedAt });
  assert.equal(result.classification, "CONSULT");
  assert.equal(result.valid, true);
  assert.equal(result.can_submit, false);
  assert.match(result.reason, /leitura externa/);
});

test("as sete mutações são classificadas e bloqueadas pelo contrato", () => {
  for (const action of OPERATION_MUTATION_ACTIONS) {
    const result = createOperationCommandPreview({ offer: offer(), action, generatedAt });
    assert.equal(result.classification, "MUTATION");
    assert.equal(result.valid, false, action);
    assert.equal(result.can_submit, false);
    assert.match(result.reason, /bloqueada/);
    assert.ok(result.issues.some((issue) => issue.path === "approval"));
  }
});

test("banco não vira offer_id inventado; ngv é preservado", () => {
  assert.equal(createOperationCommandPreview({ offer: offer("banco:257"), action: "consult", generatedAt }).command.offer_id, "PENDING");
  assert.equal(createOperationCommandPreview({ offer: offer("ngv:real-oferta"), action: "consult", generatedAt }).command.offer_id, "ngv:real-oferta");
});

test("target usa ID exato ou PENDING", () => {
  assert.equal(createOperationCommandPreview({ offer: offer(), action: "consult", generatedAt }).target, "clickup:86ajm207a");
  assert.equal(createOperationCommandPreview({ offer: { ...offer(), external_ids: { clickup: [] } }, action: "consult", generatedAt }).target, "PENDING");
});

test("preview não carrega rede, POST, env ou execução", async () => {
  const source = await readFile(new URL("../src/lib/operacao/command-preview.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch|process\.env|POST|execute|dispatch|ledger/i);
});

test("UI mantém oferta e intenção explícitas, sem execução", async () => {
  const component = await readFile(new URL("../src/components/operacao/operation-command-preview.tsx", import.meta.url), "utf8");
  const view = await readFile(new URL("../src/components/operacao/operation-view.tsx", import.meta.url), "utf8");
  assert.match(component, /selectedOfferId/);
  assert.match(component, /offers\.find/);
  assert.match(component, /Oferta/);
  assert.match(component, /Intenção/);
  assert.equal((component.match(/<select\b/g) ?? []).length, 2);
  assert.equal((component.match(/className="h-11/g) ?? []).length, 2);
  assert.doesNotMatch(component, /fetch\s*\(|<form\b|method\s*=\s*["']post/i);
  assert.doesNotMatch(component, /<button\b|Executar|Enviar|Aprovar|Sincronizar/);
  assert.match(component, /Contrato válido, envio indisponível/);
  assert.match(component, /envio indisponível/);
  assert.match(view, /<OperationCommandPreview offers=\{filteredOffers\}/);
});
