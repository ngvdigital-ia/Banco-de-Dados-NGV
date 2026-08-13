import assert from "node:assert/strict";
import test from "node:test";
import { emptyQuizAnalyticsSummary, fetchQuizAnalyticsSummary, normalizeQuizAnalyticsSummary } from "../src/lib/operacao/quiz-analytics-summary.mjs";

const config = { enabled: true, url: "https://quiz.example.test/api/admin/projects/summary", secret: "secret", hostAllowlist: "quiz.example.test" };
const project = (overrides = {}) => ({ project_id: "p-1", name: "Quiz", funnel_id: "f-1", offer_id: "o-1", banco_offer_tracking_id: 42, test_pilot: false, state: "installed", final_url: "https://quiz.example.test/quiz", deployed_at: null, first_event_at: null, ...overrides });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const body = { schema_version: 1, generated_at: "2026-08-12T12:00:00.000Z", projects: [project()] };

test("flag desligada não faz fetch e fica UNVERIFIED", async () => {
  let calls = 0;
  const result = await fetchQuizAnalyticsSummary({ config: { ...config, enabled: false }, fetchImpl: async () => { calls += 1; return response(body); } });
  assert.deepEqual(result, emptyQuizAnalyticsSummary());
  assert.equal(calls, 0);
});

test("GET seguro e vínculo só confirma ID conhecido, único e não-piloto", async () => {
  let captured;
  const result = await fetchQuizAnalyticsSummary({ config, knownBancoOfferTrackingIds: [42], fetchImpl: async (url, init) => { captured = { url, init }; return response(body); } });
  assert.equal(result.projects[0].banco_offer_tracking_link, "CONFIRMED");
  assert.equal(captured.url.toString(), config.url);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.redirect, "error");
  assert.equal(captured.init.headers.authorization, "Bearer secret");
  assert.deepEqual(Object.keys(result.projects[0]).sort(), ["banco_offer_tracking_id", "banco_offer_tracking_link", "project_id", "state"]);
  assert.equal(normalizeQuizAnalyticsSummary({ ...body, projects: [project(), project({ project_id: "p-2" })] }, { knownBancoOfferTrackingIds: [42] }).projects[0].banco_offer_tracking_link, "PENDING");
  assert.equal(normalizeQuizAnalyticsSummary(body, { knownBancoOfferTrackingIds: [42, 42] }).projects[0].banco_offer_tracking_link, "PENDING");
  assert.equal(normalizeQuizAnalyticsSummary({ ...body, projects: [project({ test_pilot: true })] }, { knownBancoOfferTrackingIds: [42] }).projects[0].banco_offer_tracking_link, "PENDING");
  assert.equal(normalizeQuizAnalyticsSummary(body, { knownBancoOfferTrackingIds: [7] }).projects[0].banco_offer_tracking_link, "PENDING");
});

test("URL, resposta e falha externa são fail-closed", async () => {
  assert.throws(() => normalizeQuizAnalyticsSummary({ ...body, schema_version: 2 }), { code: "RESPONSE_SCHEMA_INVALID" });
  const invalid = await fetchQuizAnalyticsSummary({ config: { ...config, url: "http://quiz.example.test/api/admin/projects/summary" }, fetchImpl: async () => response(body) });
  assert.equal(invalid.source, "UNAVAILABLE");
  const failed = await fetchQuizAnalyticsSummary({ config, fetchImpl: async () => { throw new Error("network"); } });
  assert.equal(failed.projects.length, 0);
});
