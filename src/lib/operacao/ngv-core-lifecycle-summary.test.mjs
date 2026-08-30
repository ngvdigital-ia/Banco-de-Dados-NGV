import assert from "node:assert/strict";
import test from "node:test";
import {
  LIFECYCLE_FACETS,
  MAX_NGV_CORE_LIFECYCLE_SUMMARY_BYTES,
  emptyNgvCoreLifecycleSummary,
  fetchNgvCoreLifecycleSummary,
  normalizeNgvCoreLifecycleSummary as normalizeLifecycleSummary,
  projectNgvCoreLifecycleEvidence,
  validateNgvCoreLifecycleSummaryUrl,
} from "./ngv-core-lifecycle-summary.mjs";

const timestamp = "2026-08-28T12:34:56.789Z";
const now = new Date(timestamp);
const normalizeNgvCoreLifecycleSummary = (value, options = {}) => normalizeLifecycleSummary(value, { now, ...options });
const facets = (state = "PASS", observedAt = timestamp) => Object.fromEntries(
  LIFECYCLE_FACETS.map((facet) => [facet, { state, observed_at: observedAt }]),
);
const offer = ({ offerId = "ngv:oferta-um", bancoId = 11, state = "PASS", facetValues = facets() } = {}) => ({
  offer_id: offerId,
  banco_offer_tracking_id: bancoId,
  state,
  facets: facetValues,
});
const body = ({ offers = [offer()] } = {}) => ({
  schema_version: 1,
  source: "ngv-core-lifecycle",
  generated_at: timestamp,
  offers,
});
const response = (value, status = 200, contentType = "application/json") => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": contentType },
});
const config = {
  enabled: true,
  url: "https://core.ngvdigital.com/functions/v1/offer-lifecycle-summary-read",
  readerKey: "reader-key",
  allowedHosts: "core.ngvdigital.com",
};

test("flag desligada não faz fetch", async () => {
  let calls = 0;
  const result = await fetchNgvCoreLifecycleSummary({
    config: { ...config, enabled: false },
    fetchImpl: async () => { calls += 1; return response(body()); },
  });
  assert.deepEqual(result, emptyNgvCoreLifecycleSummary());
  assert.equal(calls, 0);
});

test("POST envia apenas schema_version, chave privada, no-store e redirect manual", async () => {
  let captured;
  const result = await fetchNgvCoreLifecycleSummary({
    config,
    now,
    fetchImpl: async (url, init) => { captured = { url, init }; return response(body()); },
  });
  assert.equal(result.kind, "success");
  assert.equal(captured.url.toString(), config.url);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.cache, "no-store");
  assert.equal(captured.init.redirect, "manual");
  assert.deepEqual(captured.init.headers, {
    "content-type": "application/json",
    "x-ngv-core-key": config.readerKey,
  });
  assert.deepEqual(JSON.parse(captured.init.body), { schema_version: 1 });
});

test("configuração inválida não faz fetch e só aceita HTTPS público sem partes proibidas", async () => {
  const rejected = [
    "http://core.ngvdigital.com/read",
    "https://user:pass@core.ngvdigital.com/read",
    "https://core.ngvdigital.com/read?secret=x",
    "https://core.ngvdigital.com/read#fragment",
    "https://core.ngvdigital.com:8443/read",
    "https://localhost/read",
    "https://127.0.0.1/read",
    "https://10.0.0.8/read",
    "https://[::1]/read",
    "https://[fe90::1]/read",
    "https://[febf::1]/read",
    "https://[2001:db8::1]/read",
    "https://[::ffff:127.0.0.1]/read",
    "https://core.local/read",
    "https://core.localhost/read",
    "https://core.internal/read",
    "https://core.test/read",
    "https://core.invalid/read",
    "https://core.example/read",
    "https://core.123/read",
  ];
  for (const url of rejected) assert.throws(() => validateNgvCoreLifecycleSummaryUrl(url, config.allowedHosts), { code: "SUMMARY_URL_INVALID" });
  assert.equal(validateNgvCoreLifecycleSummaryUrl(config.url, config.allowedHosts).hostname, "core.ngvdigital.com");
  assert.throws(
    () => validateNgvCoreLifecycleSummaryUrl("https://attacker.example.org/functions/v1/offer-lifecycle-summary-read", config.allowedHosts),
    { code: "SUMMARY_HOST_NOT_ALLOWLISTED" },
  );
  let calls = 0;
  const result = await fetchNgvCoreLifecycleSummary({
    config: { ...config, url: "https://127.0.0.1/read" }, now,
    fetchImpl: async () => { calls += 1; return response(body()); },
  });
  assert.equal(result.code, "SUMMARY_URL_INVALID");
  assert.equal(calls, 0);
});

test("chave ausente, 401, redirect e timeout falham fechados sem ecoar dado remoto", async () => {
  assert.equal((await fetchNgvCoreLifecycleSummary({ config: { ...config, readerKey: "" }, now })).code, "READER_KEY_MISSING");
  assert.equal((await fetchNgvCoreLifecycleSummary({ config, now, fetchImpl: async () => response({ private: "x" }, 401) })).code, "SUMMARY_REQUEST_INVALID");
  assert.equal((await fetchNgvCoreLifecycleSummary({ config, now, fetchImpl: async () => response({ location: "https://private.example" }, 302) })).kind, "unavailable");
  assert.equal((await fetchNgvCoreLifecycleSummary({ config, now, fetchImpl: async () => response(body(), 200, "text/plain") })).code, "RESPONSE_MEDIA_TYPE_INVALID");
  const timeout = await fetchNgvCoreLifecycleSummary({
    config: { ...config, timeoutMs: 1 },
    now,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  });
  assert.equal(timeout.code, "SUMMARY_TIMEOUT");
  assert.equal(JSON.stringify(timeout).includes("reader-key"), false);
});

test("resposta limitada, malformada, com chave extra ou vazamento é recusada", async () => {
  const tooLarge = new Response("x".repeat(MAX_NGV_CORE_LIFECYCLE_SUMMARY_BYTES + 1), { headers: { "content-type": "application/json" } });
  assert.equal((await fetchNgvCoreLifecycleSummary({ config, now, fetchImpl: async () => tooLarge })).code, "RESPONSE_TOO_LARGE");
  assert.throws(() => normalizeNgvCoreLifecycleSummary({ ...body(), extra: true }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [{ ...offer(), artifact_ref: "private" }] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [{ ...offer(), facets: { ...facets(), scope: { state: "PASS", observed_at: timestamp, url: "https://leak.example" } } }] })), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("exige as sete facetas, timestamps UTC e estado global derivado", () => {
  const staleFacets = facets();
  staleFacets.tracking = { state: "STALE", observed_at: null };
  const normalized = normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ state: "STALE", facetValues: staleFacets })] }));
  assert.equal(normalized.offers[0].state, "STALE");
  assert.deepEqual(Object.keys(normalized.offers[0].facets).sort(), [...LIFECYCLE_FACETS].sort());
  const missing = facets(); delete missing.visual;
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ facetValues: missing })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ state: "PASS", facetValues: staleFacets })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  const badTime = facets(); badTime.scope = { state: "PASS", observed_at: "2026-08-28T12:34:56Z" };
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ facetValues: badTime })] })), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("generated_at precisa estar em UTC com milissegundos e dentro da janela de cinco minutos", async () => {
  assert.throws(() => normalizeNgvCoreLifecycleSummary({ ...body(), generated_at: "2026-08-28T12:34:56Z" }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary({ ...body(), generated_at: "2026-08-28T12:29:56.788Z" }), { code: "SUMMARY_STALE" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary({ ...body(), generated_at: "2026-08-28T12:39:56.790Z" }), { code: "SUMMARY_STALE" });
  const unavailable = await fetchNgvCoreLifecycleSummary({
    config,
    now,
    fetchImpl: async () => response({ ...body(), generated_at: "2026-08-28T12:29:56.788Z" }),
  });
  assert.equal(unavailable.code, "SUMMARY_STALE");
});

test("projeção inclui todas as ofertas locais e só confirma dupla identidade", () => {
  const summary = normalizeNgvCoreLifecycleSummary(body({ offers: [offer()] }));
  const projection = projectNgvCoreLifecycleEvidence([
    { id: 11, canonicalOfferId: "ngv:oferta-um" },
    { id: 12, canonicalOfferId: "ngv:sem-core" },
    { id: 13, canonicalOfferId: null },
  ], summary);
  assert.equal(projection.records.length, 3);
  assert.deepEqual(projection.records.map((record) => [record.offerTrackingId, record.identityState, record.state]), [
    [11, "CONFIRMED", "PASS"],
    [12, "CONFIRMED", "PENDING"],
    [13, "IDENTITY_PENDING", "PENDING"],
  ]);
  assert.equal(projection.sourceFreshness.generatedAt, timestamp);
  assert.equal("artifact_ref" in projection.records[0], false);
  assert.equal("url" in projection.records[0], false);
});

test("id trocado, canonical divergente e duplicata local são DIVERGENT; órfão Core não promove", () => {
  const mismatchId = normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ bancoId: 99 })] }));
  assert.equal(projectNgvCoreLifecycleEvidence([{ id: 11, canonicalOfferId: "ngv:oferta-um" }], mismatchId).records[0].state, "DIVERGENT");
  const mismatchCanonical = normalizeNgvCoreLifecycleSummary(body({ offers: [offer({ offerId: "ngv:outra", bancoId: 11 })] }));
  assert.equal(projectNgvCoreLifecycleEvidence([{ id: 11, canonicalOfferId: "ngv:oferta-um" }], mismatchCanonical).records[0].state, "DIVERGENT");
  const matched = normalizeNgvCoreLifecycleSummary(body());
  const duplicate = projectNgvCoreLifecycleEvidence([
    { id: 11, canonicalOfferId: "ngv:oferta-um" },
    { id: 12, canonicalOfferId: "ngv:oferta-um" },
  ], matched);
  assert.deepEqual(duplicate.records.map((record) => record.state), ["DIVERGENT", "DIVERGENT"]);
  const orphan = projectNgvCoreLifecycleEvidence([{ id: 12, canonicalOfferId: "ngv:sem-core" }], matched);
  assert.equal(orphan.records[0].state, "PENDING");
  assert.equal(orphan.records.length, 1);
});

test("ofertas Core precisam ser únicas por ID canônico e ID do Banco", () => {
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [offer(), offer({ bancoId: 12 })] })), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreLifecycleSummary(body({ offers: [offer(), offer({ offerId: "ngv:outra" })] })), { code: "RESPONSE_SCHEMA_INVALID" });
});
