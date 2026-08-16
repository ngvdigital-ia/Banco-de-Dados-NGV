import assert from "node:assert/strict";
import test from "node:test";
import { backupValido, construirCsv, parseImportacao } from "../src/components/sistemas/spy/importacao-logic.mjs";

function gerarIdSequencial() {
  let n = 0;
  return () => `gerado-${++n}`;
}

test("parseImportacao: cria oferta nova + leitura quando nada existe ainda", () => {
  const texto = "Mestre da Cama;saúde masculina;alemão;VSL;28/07/2026;manha;180";
  const r = parseImportacao(texto, [], [], gerarIdSequencial());
  assert.equal(r.ofertasNovas.length, 1);
  assert.equal(r.ofertasNovas[0].nome, "Mestre da Cama");
  assert.equal(r.leiturasTocadas.length, 1);
  assert.deepEqual(r.leiturasTocadas[0], {
    id: "gerado-2",
    ofertaId: "gerado-1",
    data: "2026-07-28",
    periodo: "manha",
    ads: 180,
  });
  assert.equal(r.ignoradas, 0);
});

test("parseImportacao: linha de cabeçalho é ignorada, não vira oferta 'oferta'", () => {
  const texto = "oferta;nicho;idioma;formato;data;periodo;anuncios\nX;n;i;VSL;01/01/2026;manha;10";
  const r = parseImportacao(texto, [], [], gerarIdSequencial());
  assert.equal(r.ofertasNovas.length, 1);
  assert.equal(r.ofertasNovas[0].nome, "X");
});

test("parseImportacao: oferta já existente reaproveita o id, não cria duplicata", () => {
  const existentes = [{ id: "o1", nome: "Mestre da Cama", formato: "VSL", nicho: "saúde masculina", idioma: "alemão" }];
  const texto = "Mestre da Cama;;;29/07/2026;noite;200";
  const r = parseImportacao(texto, existentes, [], gerarIdSequencial());
  assert.equal(r.ofertasNovas.length, 0);
  assert.equal(r.leiturasTocadas[0].ofertaId, "o1");
});

test("parseImportacao: linha sem nome é ignorada e contabilizada", () => {
  const r = parseImportacao(";nicho;idioma;VSL;01/01/2026;manha;10", [], [], gerarIdSequencial());
  assert.equal(r.ofertasNovas.length, 0);
  assert.equal(r.ignoradas, 1);
});

test("parseImportacao: leitura já existente é ATUALIZADA (upsert), não duplicada", () => {
  const existentes = [{ id: "o1", nome: "X" }];
  const leituras = [{ id: "l1", ofertaId: "o1", data: "2026-07-28", periodo: "manha", ads: 100 }];
  const r = parseImportacao("X;;;28/07/2026;manha;150", existentes, leituras, gerarIdSequencial());
  assert.equal(r.leiturasTocadas.length, 1);
  assert.equal(r.leiturasTocadas[0].id, "l1");
  assert.equal(r.leiturasTocadas[0].ads, 150);
});

test("construirCsv: cabeçalho fixo + 1 linha por leitura, ordenado cronologicamente", () => {
  const ofertas = [{ id: "o1", nome: "X", nicho: "n", idioma: "i", formato: "VSL" }];
  const leituras = [
    { id: "l2", ofertaId: "o1", data: "2026-07-29", periodo: "manha", ads: 200 },
    { id: "l1", ofertaId: "o1", data: "2026-07-28", periodo: "manha", ads: 100 },
  ];
  const csv = construirCsv(ofertas, leituras);
  const linhas = csv.split("\n");
  assert.equal(linhas[0], "oferta;nicho;idioma;formato;data;periodo;anuncios");
  assert.equal(linhas[1], "X;n;i;VSL;2026-07-28;manha;100");
  assert.equal(linhas[2], "X;n;i;VSL;2026-07-29;manha;200");
});

test("backupValido: exige ofertas[] e leituras[] no objeto", () => {
  assert.equal(backupValido({ ofertas: [], leituras: [] }), true);
  assert.equal(backupValido({ ofertas: [] }), false);
  assert.equal(backupValido(null), false);
  assert.equal(backupValido("texto"), false);
});
