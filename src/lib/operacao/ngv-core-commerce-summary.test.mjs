import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCE_METRICS,
  MAX_NGV_CORE_COMMERCE_SUMMARY_BYTES,
  emptyNgvCoreCommerceSummary,
  fetchNgvCoreCommerceSummary,
  normalizeNgvCoreCommerceSummary as normalizeCommerceSummary,
  projectNgvCoreCommerceReadback,
  validateNgvCoreCommerceSummaryUrl,
} from "./ngv-core-commerce-summary.mjs";

const timestamp = "2026-08-28T12:34:56.789Z";
const now = new Date(timestamp);
const normalizeNgvCoreCommerceSummary = (value, options = {}) => normalizeCommerceSummary(value, { now, ...options });
const metrics = (overrides = {}) => ({
  catalog_product_count: 2,
  mapped_product_count: 2,
  sale_count: 1,
  active_access_count: 1,
  quarantine_count: 0,
  readback_count: 1,
  ...overrides,
});
const offer = ({ bancoId = 11, state = "READBACK_OBSERVED", values = metrics() } = {}) => ({
  banco_offer_tracking_id: bancoId,
  state,
  metrics: values,
});
const body = ({ offers = [offer()] } = {}) => ({
  schema_version: 1,
  source: "ngv-core-commerce",
  generated_at: timestamp,
  offers,
});
const response = (value, status = 200, contentType = "application/json") => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": contentType },
});
const config = {
  enabled: true,
  url: "https://core.ngvdigital.com/functions/v1/offer-commerce-summary-read",
  readerKey: "commerce-reader-key",
  allowedHosts: "core.ngvdigital.com",
};

test("flag desligada não faz fetch", async () => {
  let calls = 0;
  const result = await fetchNgvCoreCommerceSummary({
    config: { ...config, enabled: false },
    fetchImpl: async () => { calls += 1; return response(body()); },
  });
  assert.deepEqual(result, emptyNgvCoreCommerceSummary());
  assert.equal(calls, 0);
});

test("POST usa corpo agregado exato, credencial privada, no-store e redirect manual", async () => {
  let captured;
  const result = await fetchNgvCoreCommerceSummary({
    config,
    now,
    fetchImpl: async (url, init) => { captured = { url, init }; return response(body()); },
  });
  assert.equal(result.kind, "success");
  assert.equal(captured.url.toString(), config.url);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.cache, "no-store");
  assert.equal(captured.init.redirect, "manual");
  assert.deepEqual(captured.init.headers, { "content-type": "application/json", "x-ngv-core-key": config.readerKey });
  assert.deepEqual(JSON.parse(captured.init.body), { schema_version: 1 });
});

test("URL exige host allowlisted, path exato e rejeita redes e partes proibidas", () => {
  const rejected = [
    "http://core.ngvdigital.com/read",
    "https://user:pass@core.ngvdigital.com/read",
    "https://core.ngvdigital.com/read?x=1",
    "https://core.ngvdigital.com/read#x",
    "https://core.ngvdigital.com:8443/read",
    "https://localhost/read",
    "https://10.0.0.8/read",
    "https://[::1]/read",
    "https://[fe90::1]/read",
    "https://[2001:db8::1]/read",
    "https://[::ffff:127.0.0.1]/read",
    "https://core.local/read",
    "https://core.internal/read",
    "https://core.123/read",
    "https://core.ngvdigital.com/functions/v1/outra",
  ];
  for (const url of rejected) assert.throws(() => validateNgvCoreCommerceSummaryUrl(url, "core.ngvdigital.com"), { code: "SUMMARY_URL_INVALID" });
  assert.throws(
    () => validateNgvCoreCommerceSummaryUrl("https://attacker.example.org/functions/v1/offer-commerce-summary-read", "core.ngvdigital.com"),
    { code: "SUMMARY_HOST_NOT_ALLOWLISTED" },
  );
  assert.equal(validateNgvCoreCommerceSummaryUrl(config.url, config.allowedHosts).hostname, "core.ngvdigital.com");
});

test("configuração, 401, redirect, media type, timeout e body grande falham fechados", async () => {
  let calls = 0;
  assert.equal((await fetchNgvCoreCommerceSummary({
    config: { ...config, url: "https://127.0.0.1/read" }, now,
    fetchImpl: async () => { calls += 1; return response(body()); },
  })).code, "SUMMARY_URL_INVALID");
  assert.equal(calls, 0);
  assert.equal((await fetchNgvCoreCommerceSummary({ config: { ...config, readerKey: "" }, now })).code, "READER_KEY_MISSING");
  assert.equal((await fetchNgvCoreCommerceSummary({ config, now, fetchImpl: async () => response({ private: "x" }, 401) })).code, "SUMMARY_REQUEST_INVALID");
  assert.equal((await fetchNgvCoreCommerceSummary({ config, now, fetchImpl: async () => response(body(), 302) })).kind, "unavailable");
  assert.equal((await fetchNgvCoreCommerceSummary({ config, now, fetchImpl: async () => response(body(), 200, "text/plain") })).code, "RESPONSE_MEDIA_TYPE_INVALID");
  const tooLarge = new Response("x".repeat(MAX_NGV_CORE_COMMERCE_SUMMARY_BYTES + 1), { headers: { "content-type": "application/json" } });
  assert.equal((await fetchNgvCoreCommerceSummary({ config, now, fetchImpl: async () => tooLarge })).code, "RESPONSE_TOO_LARGE");
  const timeout = await fetchNgvCoreCommerceSummary({
    config: { ...config, timeoutMs: 1 }, now,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  });
  assert.equal(timeout.code, "SUMMARY_TIMEOUT");
  assert.equal(JSON.stringify(timeout).includes(config.readerKey), false);
});

test("parser exige envelope, seis métricas, invariantes e freshness de cinco minutos", () => {
  const normalized = normalizeNgvCoreCommerceSummary(body());
  assert.deepEqual(Object.keys(normalized.offers[0].metrics).sort(), [...COMMERCE_METRICS].sort());
  assert.throws(() => normalizeNgvCoreCommerceSummary({ ...body(), extra: true }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreCommerceSummary(body({ offers: [{ ...offer(), product_id: "private" }] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreCommerceSummary(body({ offers: [offer({ values: metrics({ mapped_product_count: 3 }) })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.doesNotThrow(() => normalizeNgvCoreCommerceSummary(body({ offers: [offer({ state: "ACCESS_MISSING", values: metrics({ active_access_count: 1, readback_count: 0 }) })] })));
  assert.throws(() => normalizeNgvCoreCommerceSummary(body({ offers: [offer({ state: "ACCESS_MISSING", values: metrics({ readback_count: 1 }) })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreCommerceSummary({ ...body(), generated_at: "2026-08-28T12:29:56.788Z" }), { code: "SUMMARY_STALE" });
  assert.throws(() => normalizeNgvCoreCommerceSummary({ ...body(), generated_at: "2026-08-28T12:34:56Z" }), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("ofertas Core são únicas por Banco ID e não vazam produto, slug, URL, hash ou PII", () => {
  assert.throws(() => normalizeNgvCoreCommerceSummary(body({ offers: [offer(), offer({ bancoId: 11 })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  const projection = projectNgvCoreCommerceReadback([{ id: 11, canonicalOfferId: "ngv:oferta-um" }], normalizeNgvCoreCommerceSummary(body()));
  assert.equal(projection.records[0].state, "READBACK_OBSERVED");
  assert.equal("product_id" in projection.records[0], false);
  assert.equal("slug" in projection.records[0], false);
  assert.equal("url" in projection.records[0], false);
  assert.equal("hash" in projection.records[0], false);
  assert.equal("email" in projection.records[0], false);
});

test("todas as ofertas locais aparecem; identidade ausente, duplicata, órfão e summary indisponível não promovem", () => {
  const summary = normalizeNgvCoreCommerceSummary(body());
  const projection = projectNgvCoreCommerceReadback([
    { id: 11, canonicalOfferId: "ngv:oferta-um" },
    { id: 12, canonicalOfferId: "ngv:sem-core" },
    { id: 13, canonicalOfferId: null },
  ], summary);
  assert.deepEqual(projection.records.map((record) => [record.offerTrackingId, record.identityState, record.state]), [
    [11, "CONFIRMED", "READBACK_OBSERVED"],
    [12, "CONFIRMED", "PENDING"],
    [13, "IDENTITY_PENDING", "PENDING"],
  ]);
  const duplicate = projectNgvCoreCommerceReadback([
    { id: 11, canonicalOfferId: "ngv:oferta-um" },
    { id: 12, canonicalOfferId: "ngv:oferta-um" },
  ], summary);
  assert.deepEqual(duplicate.records.map((record) => record.state), ["DIVERGENT", "DIVERGENT"]);
  const unavailable = projectNgvCoreCommerceReadback([{ id: 11, canonicalOfferId: "ngv:oferta-um" }], { kind: "unavailable" });
  assert.equal(unavailable.records[0].state, "PENDING");
  assert.equal(unavailable.sourceFreshness.state, "UNAVAILABLE");
});
