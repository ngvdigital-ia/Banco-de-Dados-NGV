import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OFFER_LOOKUP_CODES,
  isAuthorizedBearer,
  lookupOffer,
  parseIdentifier,
  projectOffer,
} from "../src/lib/offers/lookup.mjs";

const ROUTE_PATH = new URL("../src/app/api/admin/offers/lookup/route.ts", import.meta.url);
const DOMAINS_ROUTE_PATH = new URL("../src/app/api/admin/offer-domains/route.ts", import.meta.url);

const SECRET = "segredo-de-teste";
const AUTH = `Bearer ${SECRET}`;

function row(overrides = {}) {
  return {
    id: 12,
    name: "Alpha DE",
    language: "DE",
    ticket: "97",
    gender: "M",
    adFormat: "VSL",
    copyVslStatus: "SIM",
    copyCriativosStatus: "NAO",
    vslInVturb: "SIM",
    campaignsActive: "SIM",
    validation: "SIM",
    preScale: "NAO",
    scale: "EM ANDAMENTO",
    productCreated: "SIM",
    productApproved: "SIM",
    siteCreated: "SIM",
    adsEditedCount: 4,
    adsRejectedCount: 1,
    siteUrls: {
      domain: "alpha.de",
      vsl: "https://alpha.de/vsl",
      whites: ["https://alpha.de/white-1"],
      quiz: "https://alpha.de/quiz",
      custom: [{ label: "checkout", url: "https://pay.exemplo.com/c?token=EXEMPLO-NAO-SECRETO" }],
    },
    siteUrl: "https://alpha.de/vsl",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    updatedAt: new Date("2026-02-03T04:05:06.000Z"),
    ...overrides,
  };
}

function fakeDb({ byId = new Map(), byName = [] } = {}) {
  const calls = { findById: [], findByName: [] };
  return {
    calls,
    findById: async (id) => {
      calls.findById.push(id);
      return byId.get(id) ?? null;
    },
    findByName: async (name) => {
      calls.findByName.push(name);
      return byName;
    },
  };
}

const boom = {
  findById: async () => {
    throw new Error("findById não deveria ser chamado");
  },
  findByName: async () => {
    throw new Error("findByName não deveria ser chamado");
  },
};

// ── 401: sem autenticação ────────────────────────────────────────────────────

test("sem header de autorização: 401 e o banco nem é tocado", async () => {
  const result = await lookupOffer({
    authHeader: null,
    cronSecret: SECRET,
    params: { id: "12" },
    ...boom,
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.UNAUTHORIZED);
  assert.equal(result.body.offer, undefined);
});

test("segredo errado, esquema errado ou CRON_SECRET ausente: 401 (fail-closed)", async () => {
  const cases = [
    { authHeader: "Bearer outro-segredo", cronSecret: SECRET },
    { authHeader: SECRET, cronSecret: SECRET }, // sem o prefixo Bearer
    { authHeader: "Bearer undefined", cronSecret: undefined },
    { authHeader: AUTH, cronSecret: undefined },
    { authHeader: AUTH, cronSecret: "" },
  ];
  for (const c of cases) {
    const result = await lookupOffer({ ...c, params: { id: "12" }, ...boom });
    assert.equal(result.status, 401, JSON.stringify(c));
  }
  assert.equal(isAuthorizedBearer(AUTH, SECRET), true);
});

// ── 200: achado por id ───────────────────────────────────────────────────────

test("achado por id: 200 com o registro completo e o siteUrls inteiro", async () => {
  const db = fakeDb({ byId: new Map([[12, row()]]) });
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { id: "12" },
    ...db,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.matchedBy, "id");
  assert.deepEqual(db.calls.findById, [12], "id tem que chegar no banco como número");
  assert.equal(db.calls.findByName.length, 0);

  const offer = result.body.offer;
  assert.equal(offer.id, 12);
  assert.equal(offer.name, "Alpha DE");
  assert.equal(offer.language, "DE");
  assert.equal(offer.domain, "alpha.de");
  assert.equal(offer.hasSiteUrls, true);
  // siteUrls INTEIRO: domain, vsl, whites, quiz e custom
  assert.deepEqual(offer.siteUrls, row().siteUrls);
  assert.equal(offer.status.validation, "SIM");
  assert.equal(offer.status.siteCreated, "SIM");
  assert.equal(offer.ads.editedCount, 4);
  assert.equal(offer.createdAt, "2026-01-02T03:04:05.000Z");
  assert.equal(offer.updatedAt, "2026-02-03T04:05:06.000Z");
});

test("oferta sem site_urls: hasSiteUrls false, siteUrls null, sem quebrar", async () => {
  const db = fakeDb({ byId: new Map([[7, row({ id: 7, siteUrls: null, siteUrl: null })]]) });
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { id: "7" },
    ...db,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.offer.hasSiteUrls, false);
  assert.equal(result.body.offer.siteUrls, null);
  assert.equal(result.body.offer.domain, null);
});

// ── 200: achado por nome ─────────────────────────────────────────────────────

test("achado por nome com 1 match: 200, matchedBy name, nome vai trimado pro banco", async () => {
  const db = fakeDb({ byName: [row()] });
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { name: "  alpha  " },
    ...db,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.matchedBy, "name");
  assert.equal(result.body.offer.id, 12);
  assert.deepEqual(db.calls.findByName, ["alpha"]);
});

// ── 409: nome ambíguo ────────────────────────────────────────────────────────

test("nome ambíguo: 409 com candidatas e NENHUMA escolha arbitrária", async () => {
  const matches = [
    row({ id: 12, name: "Alpha DE", language: "DE" }),
    row({ id: 30, name: "Alpha PT", language: "PT", siteUrls: { domain: "alpha.com.br" } }),
  ];
  const db = fakeDb({ byName: matches });
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { name: "Alpha" },
    ...db,
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.OFFER_NAME_AMBIGUOUS);
  assert.equal(result.body.offer, undefined, "409 não pode entregar oferta escolhida no chute");
  assert.equal(result.body.totalMatches, 2);
  assert.equal(result.body.candidates.length, 2);
  assert.deepEqual(
    result.body.candidates.map((c) => c.id),
    [12, 30],
  );
  // candidata precisa trazer com que DESEMPATAR
  assert.deepEqual(result.body.candidates[1], {
    id: 30,
    name: "Alpha PT",
    language: "PT",
    validation: "SIM",
    domain: "alpha.com.br",
    createdAt: "2026-01-02T03:04:05.000Z",
  });
  assert.match(String(result.body.error), /\?id=/);
});

test("nome ambíguo com muitos matches: candidatas limitadas a 10, totalMatches é o número real", async () => {
  const matches = Array.from({ length: 23 }, (_, i) => row({ id: i + 1, name: `Alpha ${i + 1}` }));
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { name: "Alpha" },
    ...fakeDb({ byName: matches }),
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.totalMatches, 23);
  assert.equal(result.body.candidates.length, 10);
});

// ── 404: inexistente ─────────────────────────────────────────────────────────

test("id inexistente: 404 com hint que ENSINA onde achar o id", async () => {
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { id: "999" },
    ...fakeDb(),
  });
  assert.equal(result.status, 404);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.OFFER_NOT_FOUND);
  assert.match(String(result.body.error), /#999/);
  assert.match(String(result.body.hint), /GET \/api\/admin\/offers/);
  assert.match(String(result.body.hint), /\?name=/);
});

test("nome sem match: 404 explicando que a busca é 'contém'", async () => {
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { name: "não existe" },
    ...fakeDb({ byName: [] }),
  });
  assert.equal(result.status, 404);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.OFFER_NOT_FOUND);
  assert.match(String(result.body.hint), /contém/);
});

// ── 400: identificador ausente/inválido ──────────────────────────────────────

test("sem id e sem nome: 400 MISSING_IDENTIFIER, banco intocado", async () => {
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: {},
    ...boom,
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.MISSING_IDENTIFIER);
});

test("id não-inteiro/zero/negativo: 400 INVALID_ID em vez de virar busca por nome", async () => {
  for (const id of ["12abc", "1.5", "-3", "0", "abc", "99999999999"]) {
    const result = await lookupOffer({
      authHeader: AUTH,
      cronSecret: SECRET,
      params: { id, name: "Alpha" },
      ...boom,
    });
    assert.equal(result.status, 400, `id=${id}`);
    assert.equal(result.body.code, OFFER_LOOKUP_CODES.INVALID_ID, `id=${id}`);
  }
});

test("id e name juntos: id ganha (mesma precedência do POST /api/admin/offer-domains)", async () => {
  const db = fakeDb({ byId: new Map([[12, row()]]), byName: [row({ id: 99 })] });
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { id: "12", name: "Alpha" },
    ...db,
  });
  assert.equal(result.body.matchedBy, "id");
  assert.equal(db.calls.findByName.length, 0);
  assert.deepEqual(parseIdentifier({ id: "12", name: "Alpha" }), { kind: "id", id: 12 });
});

test("name gigante: 400 INVALID_NAME (mesmo teto de 200 do offerName do POST)", async () => {
  const result = await lookupOffer({
    authHeader: AUTH,
    cronSecret: SECRET,
    params: { name: "a".repeat(201) },
    ...boom,
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, OFFER_LOOKUP_CODES.INVALID_NAME);
});

// ── projeção: allowlist, sem PII de equipe ───────────────────────────────────

test("projeção é allowlist: campo de pessoa e observations não vazam nem se vierem na linha", () => {
  const leaky = row({
    copyVsl: "Fulano de Tal",
    copyAds: "Ciclana Silva",
    editorVsl: "Beltrano",
    editorAds: "Sicrano",
    observations: "cliente pediu isso pelo whatsapp 11 99999-9999",
    adsCopyByPerson: { "Fulano de Tal": 3 },
    adsEditedByPerson: { Beltrano: 2 },
    editorStatus: { Beltrano: "OK" },
  });
  const projected = projectOffer(leaky);
  const serialized = JSON.stringify(projected);
  for (const leak of [
    "Fulano de Tal",
    "Ciclana Silva",
    "Beltrano",
    "Sicrano",
    "whatsapp",
    "99999-9999",
    "observations",
  ]) {
    assert.equal(serialized.includes(leak), false, `vazou "${leak}" no retorno`);
  }
  // status.copyVsl é o STATUS (copy_vsl_status), nunca o nome de quem escreveu (copy_vsl)
  assert.equal(projected.status.copyVsl, "SIM");
  assert.equal(projected.copyVsl, undefined);
  // e o que o consumidor precisa continua lá
  assert.match(serialized, /alpha\.de\/vsl/);
});

// ── contrato com a rota e com o POST que grava ───────────────────────────────

test("a route só faz banco: resolução, ambiguidade e projeção ficam no módulo puro", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /from "@\/lib\/offers\/lookup\.mjs"/);
  assert.match(source, /authHeader: request\.headers\.get\("authorization"\)/);
  assert.match(source, /cronSecret: process\.env\.CRON_SECRET/);
  assert.doesNotMatch(source, /candidates/, "409 não pode ser remontado dentro da route");
  assert.doesNotMatch(source, /status: 40\d/, "código HTTP vem do módulo puro");
  assert.match(source, /Cache-Control.*no-store/);
});

test("SELECT da route também é allowlist: coluna de pessoa não sai do Postgres", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  for (const column of [
    "copyVsl",
    "copyAds",
    "editorVsl",
    "editorAds",
    "observations",
    "adsCopyByPerson",
    "adsEditedByPerson",
    "editorStatus",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`offerTracking\\.${column}\\b`),
      `coluna ${column} não deveria ser selecionada`,
    );
  }
  assert.match(source, /siteUrls: offerTracking\.siteUrls/);
});

test("ler e gravar concordam: os dois casam nome por ILIKE %nome% e recusam ambíguo", async () => {
  const lookupRoute = await readFile(ROUTE_PATH, "utf8");
  const domainsRoute = await readFile(DOMAINS_ROUTE_PATH, "utf8");
  const ilikeCall = /ilike\(offerTracking\.name, `%\$\{[^}]+\}%`\)/;
  assert.match(lookupRoute, ilikeCall);
  assert.match(domainsRoute, ilikeCall, "POST mudou o casamento de nome — a leitura precisa acompanhar");
  assert.match(domainsRoute, /matches\.length > 1/, "POST precisa continuar recusando nome ambíguo");
  assert.match(domainsRoute, /status: 409/);
});
