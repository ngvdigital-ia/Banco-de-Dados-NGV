import assert from "node:assert/strict";
import test from "node:test";
import {
  construirInputCriacao,
  construirPatchEdicao,
  formularioDaOferta,
  formularioVazio,
  nomeDuplicado,
  patchVazio,
} from "../src/components/sistemas/spy/ofertas-logic.mjs";

const ofertaOriginal = {
  id: "o1",
  nome: "Mestre da Cama",
  formato: "VSL",
  nicho: "saúde masculina",
  idioma: "alemão",
  link: "https://exemplo.com/vsl",
  cloaker: "sim",
  tipoProduto: "infoproduto",
};

test("edição sem alteração: patch vazio, mutação NUNCA deveria ser chamada", () => {
  const form = formularioDaOferta(ofertaOriginal);
  const patch = construirPatchEdicao(ofertaOriginal, form);
  assert.deepEqual(patch, {}, "reabrir e salvar sem mexer em nada não pode virar PATCH real");
  assert.equal(patchVazio(patch), true);
});

test("edição com 1 campo mudado: patch só tem esse campo", () => {
  const form = formularioDaOferta(ofertaOriginal);
  form.nicho = "saúde masculina 40+";
  const patch = construirPatchEdicao(ofertaOriginal, form);
  assert.deepEqual(patch, { nicho: "saúde masculina 40+" });
  assert.equal(patchVazio(patch), false);
});

test("edição que esvazia um campo (string -> '') vira null no patch, campo entra no diff", () => {
  const form = formularioDaOferta(ofertaOriginal);
  form.link = "";
  const patch = construirPatchEdicao(ofertaOriginal, form);
  assert.deepEqual(patch, { link: null });
});

test("edição de oferta sem campos opcionais preenchidos: formulário vazio == original, patch vazio", () => {
  const original = { id: "o2", nome: "Oferta X", formato: null, nicho: null, idioma: null, link: null, cloaker: null, tipoProduto: null };
  const form = formularioDaOferta(original);
  assert.deepEqual(construirPatchEdicao(original, form), {});
});

test("construirInputCriacao: gera id via callback injetado, normaliza campo vazio pra null", () => {
  const form = { ...formularioVazio(), nome: "  Nova Oferta  ", cloaker: "", tipoProduto: "" };
  const input = construirInputCriacao(form, () => "id-fixo");
  assert.equal(input.id, "id-fixo");
  assert.equal(input.nome, "Nova Oferta");
  assert.equal(input.cloaker, null);
  assert.equal(input.tipo_produto, null);
});

test("nomeDuplicado: case-insensitive, ignora a própria oferta ao editar", () => {
  const ofertas = [{ id: "o1", nome: "Mestre da Cama" }, { id: "o2", nome: "Outra" }];
  assert.equal(nomeDuplicado(ofertas, "mestre da cama", null), true);
  assert.equal(nomeDuplicado(ofertas, "mestre da cama", "o1"), false, "editando a própria oferta não conta como duplicata");
  assert.equal(nomeDuplicado(ofertas, "Inédita", null), false);
});
