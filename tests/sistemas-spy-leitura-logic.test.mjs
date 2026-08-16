import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMovimento,
  leituraAnterior,
  leituraCompletaParaTodas,
  leituraExistente,
  montarItensLote,
  repetirContagensAnteriores,
} from "../src/components/sistemas/spy/leitura-logic.mjs";

const ofertas = [{ id: "o1" }, { id: "o2" }, { id: "o3" }];
const leituras = [
  { id: "l1", ofertaId: "o1", data: "2026-08-14", periodo: "manha", ads: 100 },
  { id: "l2", ofertaId: "o1", data: "2026-08-15", periodo: "manha", ads: 120 },
  { id: "l3", ofertaId: "o2", data: "2026-08-15", periodo: "manha", ads: 50 },
];

test("montarItensLote: campo em branco NÃO entra no lote (exigência do handoff)", () => {
  const valores = { o1: "150", o2: "", o3: undefined };
  const itens = montarItensLote({
    ofertas,
    leituras,
    data: "2026-08-16",
    periodo: "manha",
    valores,
    gerarId: () => "novo-id",
  });
  assert.equal(itens.length, 1, "só o1 tinha valor preenchido");
  assert.deepEqual(itens[0], { id: "novo-id", ofertaId: "o1", data: "2026-08-16", periodo: "manha", ads: 150 });
});

test("montarItensLote: reusa o id da leitura existente (upsert), não gera um novo", () => {
  const valores = { o1: "999" };
  const itens = montarItensLote({
    ofertas: [{ id: "o1" }],
    leituras,
    data: "2026-08-15",
    periodo: "manha",
    valores,
    gerarId: () => {
      throw new Error("não deveria gerar id novo pra leitura que já existe");
    },
  });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].id, "l2");
  assert.equal(itens[0].ads, 999);
});

test("montarItensLote: valor não numérico é ignorado, não quebra o lote", () => {
  const itens = montarItensLote({
    ofertas,
    leituras: [],
    data: "2026-08-16",
    periodo: "noite",
    valores: { o1: "abc", o2: "10" },
    gerarId: () => "x",
  });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].ofertaId, "o2");
});

test("montarItensLote: lista de ofertas vazia devolve lote vazio (não quebra nem inventa item)", () => {
  const itens = montarItensLote({
    ofertas: [],
    leituras: [],
    data: "2026-08-16",
    periodo: "manha",
    valores: {},
    gerarId: () => "x",
  });
  assert.deepEqual(itens, []);
});

test("calcularMovimento: campo vazio ou sem leitura anterior devolve null (some como '—' na UI)", () => {
  assert.equal(calcularMovimento("", 100), null);
  assert.equal(calcularMovimento("120", null), null);
  assert.equal(calcularMovimento(undefined, 100), null);
});

test("calcularMovimento: delta e percentual batem com a leitura anterior", () => {
  assert.deepEqual(calcularMovimento("150", 100), { delta: 50, pct: 50 });
  assert.deepEqual(calcularMovimento("80", 100), { delta: -20, pct: -20 });
});

test("calcularMovimento: anterior zero não divide por zero (pct vira 0, nunca Infinity/NaN)", () => {
  assert.deepEqual(calcularMovimento("10", 0), { delta: 10, pct: 0 });
});

test("leituraAnterior: pega a última leitura estritamente anterior à data+período informados", () => {
  const ant = leituraAnterior(leituras, "o1", "2026-08-16", "manha");
  assert.equal(ant?.id, "l2");
});

test("leituraExistente: encontra a leitura exata de oferta+data+período", () => {
  assert.equal(leituraExistente(leituras, "o1", "2026-08-15", "manha")?.id, "l2");
  assert.equal(leituraExistente(leituras, "o1", "2026-08-15", "noite"), null);
});

test("leituraCompletaParaTodas: só true quando TODAS as ofertas têm leitura no dia+período", () => {
  assert.equal(leituraCompletaParaTodas(ofertas, leituras, "2026-08-15", "manha"), false, "o3 não tem leitura nesse dia");
  assert.equal(leituraCompletaParaTodas([{ id: "o1" }, { id: "o2" }], leituras, "2026-08-15", "manha"), true);
});

test("leituraCompletaParaTodas: lista de ofertas vazia nunca é 'completa'", () => {
  assert.equal(leituraCompletaParaTodas([], leituras, "2026-08-15", "manha"), false);
});

test("repetirContagensAnteriores: preenche com a última contagem, ignora oferta sem histórico", () => {
  const valores = repetirContagensAnteriores(ofertas, leituras, "2026-08-16", "manha");
  assert.deepEqual(valores, { o1: "120", o2: "50" });
  assert.equal("o3" in valores, false, "sem leitura anterior, não inventa zero");
});
