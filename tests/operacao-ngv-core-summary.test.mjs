import assert from "node:assert/strict";
import test from "node:test";
import {
  NGV_CORE_OPERATIONAL_SUMMARY_URL,
  emptyNgvCoreOperationalSummary,
  fetchNgvCoreOperationalSummary,
  normalizeNgvCoreOperationalSummary,
} from "../src/lib/operacao/ngv-core-summary.mjs";

const timestamp = "2026-08-13T17:21:03.750Z";
const source = (name, extra) => ({ schema_version: 1, source: name, status: "ready", generated_at: timestamp, ...extra });
const body = {
  ok: true,
  summary: {
    schema_version: 1,
    generated_at: timestamp,
    sources: {
      spy: source("spy-analytics", { window_days: 30, offers_observed: 50, readings_observed: 170, distinct_reading_days: 6, ready_to_model: 0 }),
      nexfy: source("nexfy", { active_projects: 11, inactive_projects: 0, active_products: 23, inactive_products: 6, project_product_links: 18 }),
      banco_ngv: source("banco-ngv", { offer_tracking_count: 78, metrics_snapshot_count: 19594, latest_metric_at: timestamp, latest_offer_at: timestamp }),
      quiz_analytics: source("quiz-analytics", { project_count: 3, awaiting_deploy_count: 0, installed_count: 0, receiving_events_count: 1, projects_with_offer_id_count: 1 }),
      apps_ofertas: source("apps-ofertas", { offers_configured: 6, modules_configured: 13, lessons_configured: 39, purchases_total: 116, access_active: 106, access_revoked: 0, access_refunded: 0, access_chargeback: 4, product_grants_active: 44, latest_purchase_at: timestamp }),
      plataforma_cursos: source("plataforma-cursos", { courses_total: 6, entitlements_total: 1502, entitlements_active: 1500, entitlements_refunded: 0, entitlements_cancelled: 2, progress_total: 2058, progress_completed: 0, latest_entitlement_at: timestamp, latest_progress_at: timestamp }),
    },
  },
};
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("flag desligada não faz fetch", async () => {
  let calls = 0;
  const result = await fetchNgvCoreOperationalSummary({ config: { enabled: false, writerKey: "writer" }, fetchImpl: async () => { calls += 1; return response(body); } });
  assert.deepEqual(result, emptyNgvCoreOperationalSummary());
  assert.equal(calls, 0);
});

test("GET usa somente o cabeçalho privado e valida os seis agregados", async () => {
  let captured;
  const result = await fetchNgvCoreOperationalSummary({ config: { enabled: true, writerKey: "writer" }, fetchImpl: async (url, init) => { captured = { url, init }; return response(body); } });
  assert.equal(result.kind, "success");
  assert.deepEqual(Object.keys(result.sources).sort(), ["apps_ofertas", "banco_ngv", "nexfy", "plataforma_cursos", "quiz_analytics", "spy"]);
  assert.equal(captured.url, NGV_CORE_OPERATIONAL_SUMMARY_URL);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.cache, "no-store");
  assert.equal(captured.init.redirect, "error");
  assert.deepEqual(captured.init.headers, { "x-ngv-core-key": "writer" });
});

test("contrato inválido, ausência de writer e erro de rede falham fechados", async () => {
  assert.throws(() => normalizeNgvCoreOperationalSummary({ ...body, extra: true }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreOperationalSummary({ ...body, summary: { ...body.summary, sources: { ...body.summary.sources, spy: { ...body.summary.sources.spy, email: "x" } } } }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.equal((await fetchNgvCoreOperationalSummary({ config: { enabled: true, writerKey: "" } })).code, "WRITER_KEY_MISSING");
  assert.equal((await fetchNgvCoreOperationalSummary({ config: { enabled: true, writerKey: "writer" }, fetchImpl: async () => { throw new Error("network"); } })).kind, "unavailable");
});
