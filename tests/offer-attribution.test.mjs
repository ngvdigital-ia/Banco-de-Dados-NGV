import assert from "node:assert/strict";
import test from "node:test";
import { resolveOfferTrackingId } from "../src/lib/offer-attribution.mjs";

test("campanha que existe no mapa -> id certo, resolution: 'db'", () => {
  const dbMap = { "minha-campanha": 42 };
  const result = resolveOfferTrackingId("minha-campanha", dbMap);
  assert.deepEqual(result, { id: 42, resolution: "db" });
});

test("campanha com CAIXA e ESPACO diferentes ('  Minha Campanha  ') -> casa igual", () => {
  const dbMap = { "minha campanha": 99 };
  const result = resolveOfferTrackingId("  Minha Campanha  ", dbMap);
  assert.deepEqual(result, { id: 99, resolution: "db" });

  const resultUpper = resolveOfferTrackingId("MINHA CAMPANHA", dbMap);
  assert.deepEqual(resultUpper, { id: 99, resolution: "db" });

  const resultMixed = resolveOfferTrackingId("   mInHa CaMpAnHa   ", dbMap);
  assert.deepEqual(resultMixed, { id: 99, resolution: "db" });
});

test("campanha que nao existe -> { id: null, resolution: 'unresolved' }", () => {
  const dbMap = { "campanha-existente": 10 };
  const result = resolveOfferTrackingId("campanha-inexistente", dbMap);
  assert.deepEqual(result, { id: null, resolution: "unresolved" });
});

test("campanha null, undefined e '' -> { id: null, resolution: 'unresolved' }", () => {
  const dbMap = { "campanha-valida": 10 };

  assert.deepEqual(resolveOfferTrackingId(null, dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId(undefined, dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId("", dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId("   ", dbMap), { id: null, resolution: "unresolved" });
});

test("mapa vazio {} -> unresolved (nao pode explodir)", () => {
  const emptyMap = {};
  assert.deepEqual(resolveOfferTrackingId("qualquer-campanha", emptyMap), {
    id: null,
    resolution: "unresolved",
  });
  assert.deepEqual(resolveOfferTrackingId(null, emptyMap), {
    id: null,
    resolution: "unresolved",
  });
});

test("prova que a funcao nao inventa: chave parecida mas diferente ('campanha-x' no mapa, consulta 'campanha-y') -> unresolved", () => {
  const dbMap = { "campanha-x": 100 };
  const result = resolveOfferTrackingId("campanha-y", dbMap);
  assert.deepEqual(result, { id: null, resolution: "unresolved" });

  // Substring não pode casar (ex: "campanha" não casa com "campanha-x")
  assert.deepEqual(resolveOfferTrackingId("campanha", dbMap), {
    id: null,
    resolution: "unresolved",
  });
  // Prefix/suffix parecidos não casam
  assert.deepEqual(resolveOfferTrackingId("campanha-xx", dbMap), {
    id: null,
    resolution: "unresolved",
  });
});
