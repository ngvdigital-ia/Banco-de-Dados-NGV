import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmacaoApagarTudoValida,
  executarApagarTudoSeConfirmado,
  PALAVRA_CONFIRMACAO_APAGAR_TUDO,
} from "../src/components/sistemas/spy/apagar-tudo-logic.mjs";

test("confirmacaoApagarTudoValida: só a palavra EXATA confirma", () => {
  assert.equal(confirmacaoApagarTudoValida("APAGAR"), true);
  assert.equal(confirmacaoApagarTudoValida(""), false);
  assert.equal(confirmacaoApagarTudoValida("apagar"), false, "minúsculo não confirma");
  assert.equal(confirmacaoApagarTudoValida("APAGAR "), false, "espaço a mais não confirma — sem trim generoso");
  assert.equal(confirmacaoApagarTudoValida("APAGARTUDO"), false);
});

test("Apagar tudo SEM a palavra digitada: não dispara nada (executar nunca é chamado)", () => {
  let chamadas = 0;
  const resultado = executarApagarTudoSeConfirmado("", () => {
    chamadas++;
  });
  assert.equal(chamadas, 0, "sem confirmação, a função destrutiva nunca roda");
  assert.deepEqual(resultado, { disparado: false, motivo: "CONFIRMACAO_INVALIDA" });
});

test("Apagar tudo com texto errado (case/typo): também não dispara nada", () => {
  let chamadas = 0;
  executarApagarTudoSeConfirmado("apagar", () => chamadas++);
  executarApagarTudoSeConfirmado("APAGA", () => chamadas++);
  assert.equal(chamadas, 0);
});

test("Apagar tudo com a palavra certa: dispara exatamente uma vez", () => {
  let chamadas = 0;
  const resultado = executarApagarTudoSeConfirmado(PALAVRA_CONFIRMACAO_APAGAR_TUDO, () => {
    chamadas++;
  });
  assert.equal(chamadas, 1);
  assert.deepEqual(resultado, { disparado: true, motivo: null });
});
