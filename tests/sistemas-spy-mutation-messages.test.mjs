import assert from "node:assert/strict";
import test from "node:test";
import { descreverErroMutacaoSpy } from "../src/components/sistemas/spy/mutation-messages.mjs";

test("erro de LOGIN vs erro de OPERAÇÃO chegam com mensagens e isLoginError distintos", () => {
  const login = descreverErroMutacaoSpy({ kind: "error", code: "LOGIN_UNAUTHORIZED" });
  const operacao = descreverErroMutacaoSpy({ kind: "error", code: "OFERTA_CREATE_UNAUTHORIZED" });

  assert.equal(login.isLoginError, true);
  assert.equal(operacao.isLoginError, false);
  assert.notEqual(login.titulo, operacao.titulo);
  assert.notEqual(login.detalhe, operacao.detalhe);
  assert.match(login.detalhe, /senha/i, "erro de login precisa apontar pra credencial, não pra 'operação'");
  assert.match(operacao.detalhe, /operação|permissão/i);
});

test("todo código LOGIN_* (mesmo sem mensagem específica mapeada) ainda é reconhecido como login", () => {
  const r = descreverErroMutacaoSpy({ kind: "error", code: "LOGIN_ALGO_NOVO_NUNCA_VISTO" });
  assert.equal(r.isLoginError, true);
  assert.match(r.titulo, /login/i);
});

test("not_configured (MISSING_CREDENTIALS) nunca é tratado como erro de login — é ambiente, não senha errada", () => {
  const r = descreverErroMutacaoSpy({ kind: "not_configured", reason: "MISSING_CREDENTIALS" });
  assert.equal(r.isLoginError, false);
  assert.match(r.detalhe, /SPY_DASHBOARD_PASSWORD/);
});

test("códigos de operação distintos (validação vs not_found vs upstream) geram detalhe distinto entre si", () => {
  const validacao = descreverErroMutacaoSpy({ kind: "error", code: "LEITURAS_BATCH_VALIDATION_INVALID" });
  const notFound = descreverErroMutacaoSpy({ kind: "error", code: "LEITURA_UPDATE_NOT_FOUND" });
  const upstream = descreverErroMutacaoSpy({ kind: "error", code: "CONFIG_UPDATE_UPSTREAM_ERROR" });
  const detalhes = new Set([validacao.detalhe, notFound.detalhe, upstream.detalhe]);
  assert.equal(detalhes.size, 3, "cada categoria de falha precisa de texto próprio, erro genérico é proibido");
});

test("código desconhecido nunca quebra — cai num fallback com o próprio código, nunca mensagem genérica vazia", () => {
  const r = descreverErroMutacaoSpy({ kind: "error", code: "ALGO_TOTALMENTE_NOVO" });
  assert.equal(r.isLoginError, false);
  assert.match(r.detalhe, /ALGO_TOTALMENTE_NOVO/);
});

test("erro sem code definido não lança exceção", () => {
  assert.doesNotThrow(() => descreverErroMutacaoSpy({ kind: "error" }));
});
