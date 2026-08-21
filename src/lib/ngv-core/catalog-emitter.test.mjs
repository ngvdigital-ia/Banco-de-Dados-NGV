import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogItems,
  buildCatalogPayload,
  resolveCatalogUrl,
  emitCatalogSnapshot,
  NGV_CORE_CATALOG_PATH,
  VALIDACAO_OFERTA_MORTA,
} from "./catalog-emitter.mjs";

const CHAVES_ITEM = [
  "entity_type", "source_id", "parent_entity_type", "parent_source_id", "title",
  "description", "sort_order", "is_active", "origin_created_at", "origin_updated_at",
];

const CONFIG = {
  url: "https://exemplo.supabase.co/functions/v1/banco-global-daily-ingest",
  writerKey: "chave-de-teste",
  hostAllowlist: "exemplo.supabase.co",
};

const oferta = (extra = {}) => ({
  id: 222, name: "Squirting School", validation: "EM ANDAMENTO",
  created_at: "2026-07-02T17:28:13.000Z", updated_at: "2026-07-30T12:01:56.000Z",
  ...extra,
});

test("o item carrega EXATAMENTE as 10 chaves do contrato do Core", () => {
  const { items } = buildCatalogItems([oferta()]);
  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), [...CHAVES_ITEM].sort());
});

test("coluna nova em offer_tracking NAO vaza pro payload", () => {
  // O objeto e montado literal justamente pra isso: uma coluna nova na fonte
  // derrubaria o lote inteiro com 400 se fosse por spread.
  const { items } = buildCatalogItems([oferta({ copy_vsl: "texto", ticket: "$67" })]);
  assert.deepEqual(Object.keys(items[0]).sort(), [...CHAVES_ITEM].sort());
});

test("validation 'NAO DEU CERTO' vira is_active=false; o resto fica ativo", () => {
  const { items } = buildCatalogItems([
    oferta({ id: 1, validation: VALIDACAO_OFERTA_MORTA }),
    oferta({ id: 2, validation: "EM ANDAMENTO" }),
    oferta({ id: 3, validation: "NAO" }),
    oferta({ id: 4, validation: null }),
  ]);
  assert.deepEqual(items.map((i) => i.is_active), [false, true, true, true]);
});

test("oferta sem nome e PULADA, e as outras seguem", () => {
  const { items, ignoradas } = buildCatalogItems([
    oferta({ id: 1, name: "   " }),
    oferta({ id: 2, name: "Celestino" }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].source_id, "2");
  assert.equal(ignoradas.length, 1);
  assert.equal(ignoradas[0].motivo, "nome vazio");
});

test("datas viram ISO com milissegundos e Z (formato que a edge function exige)", () => {
  const { items } = buildCatalogItems([oferta()]);
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assert.match(items[0].origin_created_at, regex);
  assert.match(items[0].origin_updated_at, regex);
});

test("data ausente vira null, nao string invalida", () => {
  const { items } = buildCatalogItems([oferta({ created_at: null, updated_at: undefined })]);
  assert.equal(items[0].origin_created_at, null);
  assert.equal(items[0].origin_updated_at, null);
});

test("payload tem as 4 chaves e a fonte banco_ngv", () => {
  const payload = buildCatalogPayload([], "2026-08-21T13:00:00.000Z");
  assert.deepEqual(Object.keys(payload).sort(), ["generated_at", "items", "schema_version", "source_system"]);
  assert.equal(payload.source_system, "banco_ngv");
  assert.equal(payload.schema_version, 1);
});

test("a URL do catalogo troca o path e preserva o host validado", () => {
  const url = resolveCatalogUrl(CONFIG);
  assert.equal(url.pathname, NGV_CORE_CATALOG_PATH);
  assert.equal(url.hostname, "exemplo.supabase.co");
  assert.equal(url.protocol, "https:");
});

test("host fora da allowlist e recusado ANTES de qualquer rede", () => {
  assert.throws(
    () => resolveCatalogUrl({ ...CONFIG, hostAllowlist: "outro.supabase.co" }),
    /NGV_CORE_HOST_NOT_ALLOWLISTED/,
  );
});

test("sem credencial falha ANTES de tocar a rede", async () => {
  let chamou = false;
  await assert.rejects(
    () => emitCatalogSnapshot([oferta()], {
      config: { ...CONFIG, writerKey: "" },
      fetchImpl: () => { chamou = true; return Promise.resolve(new Response("{}", { status: 200 })); },
    }),
    /NGV_CORE_WRITER_KEY_MISSING/,
  );
  assert.equal(chamou, false, "nao pode ter chamado fetch");
});

test("envio bem-sucedido manda a credencial no header e devolve o resumo", async () => {
  let visto = null;
  const resultado = await emitCatalogSnapshot([oferta(), oferta({ id: 224, name: "Celestino" })], {
    config: CONFIG,
    fetchImpl: (url, init) => {
      visto = { url: url.toString(), init };
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    },
  });
  assert.equal(resultado.kind, "success");
  assert.equal(resultado.enviadas, 2);
  assert.equal(visto.init.headers["x-ngv-core-key"], "chave-de-teste");
  assert.ok(visto.url.endsWith(NGV_CORE_CATALOG_PATH));
  assert.equal(JSON.parse(visto.init.body).source_system, "banco_ngv");
});

test("resposta nao-2xx vira erro com o status, nunca sucesso silencioso", async () => {
  await assert.rejects(
    () => emitCatalogSnapshot([oferta()], {
      config: CONFIG,
      fetchImpl: () => Promise.resolve(new Response("{}", { status: 409 })),
    }),
    /CATALOG_REJECTED_409/,
  );
});
