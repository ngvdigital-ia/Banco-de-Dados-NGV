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

test("aceita os contadores privados da migração rolling na versão 2", () => {
  const rolling = {
    apps_ofertas_linked_identities: 2,
    apps_ofertas_active_accesses: 3,
    plataforma_cursos_linked_identities: 5,
    plataforma_cursos_active_accesses: 7,
    nexfy_linked_identities: 11,
    nexfy_active_accesses: 13,
  };
  const result = normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 2, rolling_migration: rolling },
  });
  assert.deepEqual(result.rolling_migration, {
    ...rolling,
    nexfy_active_entitlements: rolling.nexfy_active_accesses,
    nexfy_entitlement_exceptions: 0,
  });
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 2, rolling_migration: { ...rolling, unexpected: 1 } },
  }), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("aceita freshness estrito na versão 3 sem romper o contrato legado", () => {
  const rolling = {
    apps_ofertas_linked_identities: 2,
    apps_ofertas_active_accesses: 3,
    plataforma_cursos_linked_identities: 5,
    plataforma_cursos_active_accesses: 7,
    nexfy_linked_identities: 11,
    nexfy_active_entitlements: 13,
    nexfy_entitlement_exceptions: 0,
  };
  const legacyV3 = normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling },
  });
  assert.deepEqual(legacyV3.rolling_migration, rolling);
  assert.equal(legacyV3.freshness, null);
  const freshness = {
    all_fresh: false,
    by_source: {
      spy: { is_stale: true, age_hours: 27.5, generated_at: timestamp },
      nexfy: { is_stale: false, age_hours: 1, generated_at: timestamp },
      banco_ngv: { is_stale: false, age_hours: 2, generated_at: timestamp },
      quiz_analytics: { is_stale: false, age_hours: 3, generated_at: timestamp },
      apps_ofertas: { is_stale: false, age_hours: 4, generated_at: timestamp },
      plataforma_cursos: { is_stale: false, age_hours: 5, generated_at: timestamp },
    },
    queried_at: timestamp,
    sources_stale: 1,
    sources_total: 6,
    stale_sources: ["spy"],
    stale_threshold_hours: 24,
    oldest_source_age_hours: 27.5,
  };
  const result = normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness },
  });
  assert.deepEqual(result.rolling_migration, rolling);
  assert.deepEqual(result.freshness, freshness);
  assert.equal(normalizeNgvCoreOperationalSummary(body).freshness, null);
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness: { ...freshness, unexpected: true } },
  }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness: { ...freshness, by_source: { ...freshness.by_source, spy: { ...freshness.by_source.spy, age_hours: -1 } } } },
  }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 4, rolling_migration: rolling, freshness },
  }), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("aceita generated_at_meaning (v4) mantendo o legado v3 sem quebrar", () => {
  const rolling = {
    apps_ofertas_linked_identities: 2,
    apps_ofertas_active_accesses: 3,
    plataforma_cursos_linked_identities: 5,
    plataforma_cursos_active_accesses: 7,
    nexfy_linked_identities: 11,
    nexfy_active_entitlements: 13,
    nexfy_entitlement_exceptions: 0,
  };
  const freshness = {
    all_fresh: false,
    by_source: {
      spy: { is_stale: true, age_hours: 27.5, generated_at: timestamp },
      nexfy: { is_stale: false, age_hours: 1, generated_at: timestamp },
      banco_ngv: { is_stale: false, age_hours: 2, generated_at: timestamp },
      quiz_analytics: { is_stale: false, age_hours: 3, generated_at: timestamp },
      apps_ofertas: { is_stale: false, age_hours: 4, generated_at: timestamp },
      plataforma_cursos: { is_stale: false, age_hours: 5, generated_at: timestamp },
    },
    queried_at: timestamp,
    sources_stale: 1,
    sources_total: 6,
    stale_sources: ["spy"],
    stale_threshold_hours: 24,
    oldest_source_age_hours: 27.5,
  };

  // resposta v4 completa (6 chaves, com generated_at_meaning) → aceita, e freshness chega no retorno
  const v4 = normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness, generated_at_meaning: "hora da última leitura consolidada" },
  });
  assert.equal(v4.kind, "success");
  assert.deepEqual(v4.freshness, freshness);

  // resposta v3 antiga (5 chaves, sem generated_at_meaning) → continua aceita
  const v3 = normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness },
  });
  assert.equal(v3.kind, "success");
  assert.deepEqual(v3.freshness, freshness);

  // resposta com chave desconhecida → continua rejeitada
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness, generated_at_meaning: "x", unexpected: true },
  }), { code: "RESPONSE_SCHEMA_INVALID" });

  // generated_at_meaning com tipo errado (número em vez de texto) → rejeitada
  assert.throws(() => normalizeNgvCoreOperationalSummary({
    ok: true,
    summary: { ...body.summary, schema_version: 3, rolling_migration: rolling, freshness, generated_at_meaning: 123 },
  }), { code: "RESPONSE_SCHEMA_INVALID" });
});

test("contrato inválido, ausência de writer e erro de rede falham fechados", async () => {
  assert.throws(() => normalizeNgvCoreOperationalSummary({ ...body, extra: true }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => normalizeNgvCoreOperationalSummary({ ...body, summary: { ...body.summary, sources: { ...body.summary.sources, spy: { ...body.summary.sources.spy, email: "x" } } } }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.equal((await fetchNgvCoreOperationalSummary({ config: { enabled: true, writerKey: "" } })).code, "WRITER_KEY_MISSING");
  assert.equal((await fetchNgvCoreOperationalSummary({ config: { enabled: true, writerKey: "writer" }, fetchImpl: async () => { throw new Error("network"); } })).kind, "unavailable");
});
