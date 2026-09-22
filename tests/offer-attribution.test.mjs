import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveOfferTrackingId } from "../src/lib/offer-attribution.mjs";

const source = await readFile(
  new URL("../src/lib/offer-mappings.ts", import.meta.url),
  "utf8",
);

const parseBody = source.match(
  /export function parseCampaignId\([^)]*\):[^{]*\{([\s\S]*?)\n\}/,
)?.[1];

const resolveBody = source.match(
  /export function resolveOfferAttribution\([^)]*\):[^{]*\{([\s\S]*?)\n\}/,
)?.[1];

if (!parseBody || !resolveBody) {
  throw new Error("Não foi possível extrair parseCampaignId ou resolveOfferAttribution de offer-mappings.ts");
}

const fnFactory = new Function(`
  function parseCampaignId(utmCampaign) {
    ${parseBody}
  }
  function resolveOfferAttribution(input, maps) {
    ${resolveBody}
  }
  return { parseCampaignId, resolveOfferAttribution };
`);

const { parseCampaignId, resolveOfferAttribution } = fnFactory();

// ---------------------------------------------------------------------------
// 1. parseCampaignId
// ---------------------------------------------------------------------------

test("parseCampaignId: extrai ID numerico apos o ultimo pipe", () => {
  const result = parseCampaignId("22/05-ESCALA-EN-CBO-VSPOT-BIDCAP[80$]|120248248480980514");
  assert.equal(result, "120248248480980514");
});

test("parseCampaignId: multiplos pipes -> pega o trecho depois do ULTIMO", () => {
  const result = parseCampaignId("campanha|grupo|120248248480980514");
  assert.equal(result, "120248248480980514");
});

test("parseCampaignId: espacos ao redor do id numerico sao trimados", () => {
  const result = parseCampaignId("campanha|  120248248480980514  ");
  assert.equal(result, "120248248480980514");
});

test("parseCampaignId: 6 digitos exatos casam", () => {
  const result = parseCampaignId("campanha|123456");
  assert.equal(result, "123456");
});

test("parseCampaignId: menos de 6 digitos -> null", () => {
  assert.equal(parseCampaignId("campanha|12345"), null);
  assert.equal(parseCampaignId("campanha|1"), null);
});

test("parseCampaignId: sufixo nao-numerico -> null", () => {
  assert.equal(parseCampaignId("a|bcd"), null);
  assert.equal(parseCampaignId("campanha|123456abc"), null);
});

test("parseCampaignId: sem pipe -> null", () => {
  assert.equal(parseCampaignId("campanha-sem-pipe-120248248480980514"), null);
  assert.equal(parseCampaignId("120248248480980514"), null);
});

test("parseCampaignId: null, undefined e vazios -> null", () => {
  assert.equal(parseCampaignId(null), null);
  assert.equal(parseCampaignId(undefined), null);
  assert.equal(parseCampaignId(""), null);
  assert.equal(parseCampaignId("   "), null);
});

// ---------------------------------------------------------------------------
// 2. resolveOfferAttribution (requisitos minimos do briefing M8)
// ---------------------------------------------------------------------------

test("productCode que existe -> {id, 'product'}", () => {
  const maps = {
    byProduct: { PPPBEKO8: 42 },
    byCampaignId: { "120248248480980514": 99 },
  };
  const result = resolveOfferAttribution({ productCode: "PPPBEKO8" }, maps);
  assert.deepEqual(result, { id: 42, resolution: "product" });
});

test("productCode com espacos em volta -> trim e casa {id, 'product'}", () => {
  const maps = {
    byProduct: { PPPBEKO8: 42 },
    byCampaignId: {},
  };
  const result = resolveOfferAttribution({ productCode: "  PPPBEKO8  " }, maps);
  assert.deepEqual(result, { id: 42, resolution: "product" });
});

test("productCode ausente + utmCampaign 'nome|120248248480980514' cujo id existe -> 'campaign_id'", () => {
  const maps = {
    byProduct: { PPPBEKO8: 42 },
    byCampaignId: { "120248248480980514": 99 },
  };
  const result = resolveOfferAttribution(
    { utmCampaign: "22/05-ESCALA-EN-CBO-VSPOT-BIDCAP[80$]|120248248480980514" },
    maps,
  );
  assert.deepEqual(result, { id: 99, resolution: "campaign_id" });
});

test("productCode que existe E campanha que existe -> vence o PRODUTO", () => {
  const maps = {
    byProduct: { PPPBEKO8: 42 },
    byCampaignId: { "120248248480980514": 99 },
  };
  const result = resolveOfferAttribution(
    {
      productCode: "PPPBEKO8",
      utmCampaign: "22/05-ESCALA-EN-CBO-VSPOT-BIDCAP[80$]|120248248480980514",
    },
    maps,
  );
  assert.deepEqual(result, { id: 42, resolution: "product" });
});

test("utmCampaign SEM '|' -> unresolved", () => {
  const maps = {
    byProduct: {},
    byCampaignId: { "120248248480980514": 99 },
  };
  const result = resolveOfferAttribution(
    { utmCampaign: "campanha-sem-pipe-120248248480980514" },
    maps,
  );
  assert.deepEqual(result, { id: null, resolution: "unresolved" });
});

test("utmCampaign com sufixo nao-numerico ('a|bcd') -> unresolved", () => {
  const maps = {
    byProduct: {},
    byCampaignId: { bcd: 99 },
  };
  const result = resolveOfferAttribution({ utmCampaign: "a|bcd" }, maps);
  assert.deepEqual(result, { id: null, resolution: "unresolved" });
});

test("id com menos de 6 digitos -> unresolved", () => {
  const maps = {
    byProduct: {},
    byCampaignId: { "12345": 99 },
  };
  const result = resolveOfferAttribution({ utmCampaign: "campanha|12345" }, maps);
  assert.deepEqual(result, { id: null, resolution: "unresolved" });
});

test("mapas vazios -> unresolved, sem lancar", () => {
  const emptyMaps = { byProduct: {}, byCampaignId: {} };
  assert.deepEqual(
    resolveOfferAttribution(
      {
        productCode: "PPPBEKO8",
        utmCampaign: "campanha|120248248480980514",
      },
      emptyMaps,
    ),
    { id: null, resolution: "unresolved" },
  );
  assert.deepEqual(resolveOfferAttribution({}, emptyMaps), {
    id: null,
    resolution: "unresolved",
  });
});

test("null/undefined nos dois campos -> unresolved", () => {
  const maps = {
    byProduct: { PPPBEKO8: 42 },
    byCampaignId: { "120248248480980514": 99 },
  };
  assert.deepEqual(
    resolveOfferAttribution({ productCode: null, utmCampaign: null }, maps),
    { id: null, resolution: "unresolved" },
  );
  assert.deepEqual(
    resolveOfferAttribution({ productCode: undefined, utmCampaign: undefined }, maps),
    { id: null, resolution: "unresolved" },
  );
  assert.deepEqual(resolveOfferAttribution({}, maps), {
    id: null,
    resolution: "unresolved",
  });
});

// ---------------------------------------------------------------------------
// 3. Testes legados de resolveOfferTrackingId (mantidos para regressão)
// ---------------------------------------------------------------------------

test("legado: campanha que existe no mapa -> id certo, resolution: 'db'", () => {
  const dbMap = { "minha-campanha": 42 };
  const result = resolveOfferTrackingId("minha-campanha", dbMap);
  assert.deepEqual(result, { id: 42, resolution: "db" });
});

test("legado: campanha com CAIXA e ESPACO diferentes ('  Minha Campanha  ') -> casa igual", () => {
  const dbMap = { "minha campanha": 99 };
  const result = resolveOfferTrackingId("  Minha Campanha  ", dbMap);
  assert.deepEqual(result, { id: 99, resolution: "db" });

  const resultUpper = resolveOfferTrackingId("MINHA CAMPANHA", dbMap);
  assert.deepEqual(resultUpper, { id: 99, resolution: "db" });

  const resultMixed = resolveOfferTrackingId("   mInHa CaMpAnHa   ", dbMap);
  assert.deepEqual(resultMixed, { id: 99, resolution: "db" });
});

test("legado: campanha que nao existe -> { id: null, resolution: 'unresolved' }", () => {
  const dbMap = { "campanha-existente": 10 };
  const result = resolveOfferTrackingId("campanha-inexistente", dbMap);
  assert.deepEqual(result, { id: null, resolution: "unresolved" });
});

test("legado: campanha null, undefined e '' -> { id: null, resolution: 'unresolved' }", () => {
  const dbMap = { "campanha-valida": 10 };

  assert.deepEqual(resolveOfferTrackingId(null, dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId(undefined, dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId("", dbMap), { id: null, resolution: "unresolved" });
  assert.deepEqual(resolveOfferTrackingId("   ", dbMap), { id: null, resolution: "unresolved" });
});

test("legado: mapa vazio {} -> unresolved (nao pode explodir)", () => {
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

test("legado: prova que a funcao nao inventa: chave parecida mas diferente ('campanha-x' no mapa, consulta 'campanha-y') -> unresolved", () => {
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
