export const NGV_CORE_OPERATIONAL_SUMMARY_URL =
  "https://givqkglqwdizrpityafz.supabase.co/functions/v1/operational-summary-read";
export const NGV_CORE_OPERATIONAL_SUMMARY_TIMEOUT_MS = 3_000;
export const MAX_NGV_CORE_OPERATIONAL_SUMMARY_BYTES = 32 * 1024;

export class NgvCoreOperationalSummaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "NgvCoreOperationalSummaryError";
    this.code = code;
  }
}

const fail = (code) => { throw new NgvCoreOperationalSummaryError(code); };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const isIso = (value) => typeof value === "string" && value.length <= 64
  && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value));
const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? NGV_CORE_OPERATIONAL_SUMMARY_TIMEOUT_MS);
  return {
    enabled: options.enabled ?? process.env.OPERATION_NGV_CORE_SUMMARY_ENABLED ?? false,
    writerKey: options.writerKey ?? process.env.NGV_CORE_WRITER_KEY ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(NGV_CORE_OPERATIONAL_SUMMARY_TIMEOUT_MS, Math.max(1, timeout)) : NGV_CORE_OPERATIONAL_SUMMARY_TIMEOUT_MS,
  };
}

async function readResponse(response) {
  if (!response?.body || typeof response.body.getReader !== "function") fail("RESPONSE_BODY_UNREADABLE");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) fail("RESPONSE_BODY_UNREADABLE");
      total += part.value.byteLength;
      if (total > MAX_NGV_CORE_OPERATIONAL_SUMMARY_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof NgvCoreOperationalSummaryError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function source(value, keys, expectedSource) {
  if (value === null) return null;
  if (!isObject(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) fail("RESPONSE_SCHEMA_INVALID");
  if (value.schema_version !== 1 || value.source !== expectedSource || value.status !== "ready" || !isIso(value.generated_at)) fail("RESPONSE_SCHEMA_INVALID");
  return value;
}

export function normalizeNgvCoreOperationalSummary(body) {
  if (!isObject(body) || Object.keys(body).length !== 2 || body.ok !== true || !isObject(body.summary)) fail("RESPONSE_SCHEMA_INVALID");
  const summary = body.summary;
  const hasRollingMigration = summary.schema_version === 2 || summary.schema_version === 3;
  if (Object.keys(summary).length !== (hasRollingMigration ? 4 : 3) || ![1, 2, 3].includes(summary.schema_version) || !isIso(summary.generated_at) || !isObject(summary.sources)) fail("RESPONSE_SCHEMA_INVALID");
  const sources = summary.sources;
  const sourceKeys = ["spy", "nexfy", "banco_ngv", "quiz_analytics", "apps_ofertas", "plataforma_cursos"];
  if (Object.keys(sources).length !== sourceKeys.length || !sourceKeys.every((key) => Object.hasOwn(sources, key))) fail("RESPONSE_SCHEMA_INVALID");

  const spy = source(sources.spy, ["schema_version", "source", "status", "generated_at", "window_days", "offers_observed", "readings_observed", "distinct_reading_days", "ready_to_model"], "spy-analytics");
  const nexfy = source(sources.nexfy, ["schema_version", "source", "status", "generated_at", "active_projects", "inactive_projects", "active_products", "inactive_products", "project_product_links"], "nexfy");
  const bancoNgv = source(sources.banco_ngv, ["schema_version", "source", "status", "generated_at", "offer_tracking_count", "metrics_snapshot_count", "latest_metric_at", "latest_offer_at"], "banco-ngv");
  const quizAnalytics = source(sources.quiz_analytics, ["schema_version", "source", "status", "generated_at", "project_count", "awaiting_deploy_count", "installed_count", "receiving_events_count", "projects_with_offer_id_count"], "quiz-analytics");
  const appsOfertas = source(sources.apps_ofertas, ["schema_version", "source", "status", "generated_at", "offers_configured", "modules_configured", "lessons_configured", "purchases_total", "access_active", "access_revoked", "access_refunded", "access_chargeback", "product_grants_active", "latest_purchase_at"], "apps-ofertas");
  const plataformaCursos = source(sources.plataforma_cursos, ["schema_version", "source", "status", "generated_at", "courses_total", "entitlements_total", "entitlements_active", "entitlements_refunded", "entitlements_cancelled", "progress_total", "progress_completed", "latest_entitlement_at", "latest_progress_at"], "plataforma-cursos");

  const invalidSpy = spy && (spy.window_days !== 30 || !isCount(spy.offers_observed) || !isCount(spy.readings_observed) || !isCount(spy.distinct_reading_days) || !isCount(spy.ready_to_model));
  const invalidNexfy = nexfy && ![nexfy.active_projects, nexfy.inactive_projects, nexfy.active_products, nexfy.inactive_products, nexfy.project_product_links].every(isCount);
  const invalidBanco = bancoNgv && (!isCount(bancoNgv.offer_tracking_count) || !isCount(bancoNgv.metrics_snapshot_count)
    || !(bancoNgv.latest_metric_at === null || isIso(bancoNgv.latest_metric_at))
    || !(bancoNgv.latest_offer_at === null || isIso(bancoNgv.latest_offer_at)));
  const invalidQuiz = quizAnalytics && ![quizAnalytics.project_count, quizAnalytics.awaiting_deploy_count, quizAnalytics.installed_count, quizAnalytics.receiving_events_count, quizAnalytics.projects_with_offer_id_count].every(isCount);
  const invalidAppsOfertas = appsOfertas && (![appsOfertas.offers_configured, appsOfertas.modules_configured, appsOfertas.lessons_configured, appsOfertas.purchases_total, appsOfertas.access_active, appsOfertas.access_revoked, appsOfertas.access_refunded, appsOfertas.access_chargeback, appsOfertas.product_grants_active].every(isCount)
    || !(appsOfertas.latest_purchase_at === null || isIso(appsOfertas.latest_purchase_at)));
  const invalidPlataformaCursos = plataformaCursos && (![plataformaCursos.courses_total, plataformaCursos.entitlements_total, plataformaCursos.entitlements_active, plataformaCursos.entitlements_refunded, plataformaCursos.entitlements_cancelled, plataformaCursos.progress_total, plataformaCursos.progress_completed].every(isCount)
    || !(plataformaCursos.latest_entitlement_at === null || isIso(plataformaCursos.latest_entitlement_at))
    || !(plataformaCursos.latest_progress_at === null || isIso(plataformaCursos.latest_progress_at)));
  const rolling = hasRollingMigration ? summary.rolling_migration : null;
  const rollingKeys = summary.schema_version === 3
    ? ["apps_ofertas_linked_identities", "apps_ofertas_active_accesses", "plataforma_cursos_linked_identities", "plataforma_cursos_active_accesses", "nexfy_linked_identities", "nexfy_active_entitlements", "nexfy_entitlement_exceptions"]
    : ["apps_ofertas_linked_identities", "apps_ofertas_active_accesses", "plataforma_cursos_linked_identities", "plataforma_cursos_active_accesses", "nexfy_linked_identities", "nexfy_active_accesses"];
  if (hasRollingMigration && (!isObject(rolling) || Object.keys(rolling).length !== rollingKeys.length || !rollingKeys.every((key) => Object.hasOwn(rolling, key)) || !rollingKeys.every((key) => isCount(rolling[key])))) fail("RESPONSE_SCHEMA_INVALID");
  if (invalidSpy || invalidNexfy || invalidBanco || invalidQuiz || invalidAppsOfertas || invalidPlataformaCursos) fail("RESPONSE_SCHEMA_INVALID");

  const normalizedRolling = summary.schema_version === 2 && rolling
    ? { ...rolling, nexfy_active_entitlements: rolling.nexfy_active_accesses, nexfy_entitlement_exceptions: 0 }
    : rolling;
  return { kind: "success", generated_at: summary.generated_at, rolling_migration: normalizedRolling, sources: { spy, nexfy, banco_ngv: bancoNgv, quiz_analytics: quizAnalytics, apps_ofertas: appsOfertas, plataforma_cursos: plataformaCursos } };
}

function unavailable(code = "SUMMARY_UNAVAILABLE") {
  return { kind: "unavailable", code, generated_at: null, rolling_migration: null, sources: { spy: null, nexfy: null, banco_ngv: null, quiz_analytics: null, apps_ofertas: null, plataforma_cursos: null } };
}

export function emptyNgvCoreOperationalSummary() {
  return { kind: "disabled", code: "SUMMARY_DISABLED", generated_at: null, rolling_migration: null, sources: { spy: null, nexfy: null, banco_ngv: null, quiz_analytics: null, apps_ofertas: null, plataforma_cursos: null } };
}

export async function fetchNgvCoreOperationalSummary(options = {}) {
  const config = configFrom(options.config);
  if (config.enabled !== true && config.enabled !== "true") return emptyNgvCoreOperationalSummary();
  if (typeof config.writerKey !== "string" || !config.writerKey) return unavailable("WRITER_KEY_MISSING");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") return unavailable("FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(NGV_CORE_OPERATIONAL_SUMMARY_URL, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { "x-ngv-core-key": config.writerKey },
    });
    if (!response.ok) return unavailable(response.status >= 400 && response.status < 500 ? "SUMMARY_REQUEST_INVALID" : "SUMMARY_UNAVAILABLE");
    let body;
    try { body = JSON.parse(await readResponse(response)); } catch (error) { if (error instanceof NgvCoreOperationalSummaryError) throw error; fail("RESPONSE_JSON_INVALID"); }
    return normalizeNgvCoreOperationalSummary(body);
  } catch (error) {
    if (error instanceof NgvCoreOperationalSummaryError) return unavailable(error.code);
    return unavailable(error?.name === "AbortError" ? "SUMMARY_TIMEOUT" : "SUMMARY_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

export const getNgvCoreOperationalSummary = fetchNgvCoreOperationalSummary;
