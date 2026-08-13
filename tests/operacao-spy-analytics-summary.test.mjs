import assert from "node:assert/strict";
import test from "node:test";
import { emptySpyAnalyticsSummary, fetchSpyAnalyticsSummary, normalizeSpyAnalyticsSummary } from "../src/lib/operacao/spy-analytics-summary.mjs";

const config = { enabled: true, url: "https://spy.example.test/api/resumo", secret: "secret", hostAllowlist: "spy.example.test" };
const body = { schema_version: 1, source: "spy-analytics", status: "ready", generated_at: "2026-08-12T12:00:00.000Z", window_days: 30, offers_observed: 12, readings_observed: 34, distinct_reading_days: 8, ready_to_model: 1 };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("flag desligada não faz fetch e fica UNVERIFIED", async () => {
  let calls = 0;
  const result = await fetchSpyAnalyticsSummary({ config: { ...config, enabled: false }, fetchImpl: async () => { calls += 1; return response(body); } });
  assert.deepEqual(result, emptySpyAnalyticsSummary());
  assert.equal(calls, 0);
});

test("GET protegido retorna somente o contrato agregado", async () => {
  let captured;
  const result = await fetchSpyAnalyticsSummary({ config, fetchImpl: async (url, init) => { captured = { url, init }; return response(body); } });
  assert.deepEqual(result, { kind: "success", source: "spy-analytics", status: "ready", generated_at: body.generated_at, window_days: 30, offers_observed: 12, readings_observed: 34, distinct_reading_days: 8, ready_to_model: 1 });
  assert.equal(captured.url.toString(), config.url);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.redirect, "error");
  assert.equal(captured.init.headers.authorization, "Bearer secret");
});

test("URL, contrato e falha externa são fail-closed", async () => {
  assert.throws(() => normalizeSpyAnalyticsSummary({ ...body, window_days: 7 }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeSpyAnalyticsSummary({ ...body, ready_to_model: true }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeSpyAnalyticsSummary({ ...body, extra: "no" }), { code: "RESPONSE_SCHEMA_INVALID" });
  const invalid = await fetchSpyAnalyticsSummary({ config: { ...config, url: "http://spy.example.test/api/resumo" }, fetchImpl: async () => response(body) });
  assert.equal(invalid.source, "UNAVAILABLE");
  const failed = await fetchSpyAnalyticsSummary({ config, fetchImpl: async () => { throw new Error("network"); } });
  assert.equal(failed.offers_observed, null);
});
