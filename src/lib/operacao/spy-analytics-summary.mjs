export const SPY_ANALYTICS_SUMMARY_PATH = "/api/resumo";
export const MAX_SPY_ANALYTICS_SUMMARY_BYTES = 32 * 1024;

const MAX_COUNT = 1_000_000_000;

export class SpyAnalyticsSummaryError extends Error {
  constructor(code) { super(code); this.name = "SpyAnalyticsSummaryError"; this.code = code; }
}

const fail = (code) => { throw new SpyAnalyticsSummaryError(code); };

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hosts(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? 3000);
  return {
    enabled: options.enabled ?? process.env.OPERATION_SPY_ANALYTICS_ENABLED ?? false,
    url: options.url ?? process.env.OPERATION_SPY_ANALYTICS_SUMMARY_URL ?? "",
    secret: options.secret ?? process.env.OPERATION_SPY_ANALYTICS_SUMMARY_SECRET ?? "",
    hostAllowlist: options.hostAllowlist ?? process.env.OPERATION_SPY_ANALYTICS_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(3000, Math.max(1, timeout)) : 3000,
  };
}

function validateUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw) fail("SUMMARY_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("SUMMARY_URL_INVALID"); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password
    || url.search || url.hash || url.pathname !== SPY_ANALYTICS_SUMMARY_PATH) fail("SUMMARY_URL_INVALID");
  if (!hosts(allowlistedHosts).includes(url.hostname.toLowerCase())) fail("SUMMARY_HOST_NOT_ALLOWLISTED");
  return url;
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
      if (total > MAX_SPY_ANALYTICS_SUMMARY_BYTES) { await reader.cancel().catch(() => undefined); fail("RESPONSE_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof SpyAnalyticsSummaryError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function iso(value) {
  return typeof value === "string" && value.length <= 64
    && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function count(value) { return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT; }

export function normalizeSpyAnalyticsSummary(body) {
  const keys = ["schema_version", "source", "status", "generated_at", "window_days", "offers_observed", "readings_observed", "distinct_reading_days", "ready_to_model"];
  if (!isPlainObject(body) || Object.keys(body).some((key) => !keys.includes(key)) || !keys.every((key) => Object.hasOwn(body, key))
    || body.schema_version !== 1 || body.source !== "spy-analytics" || body.status !== "ready" || !iso(body.generated_at)
    || body.window_days !== 30 || !count(body.offers_observed) || !count(body.readings_observed)
    || !count(body.distinct_reading_days) || !count(body.ready_to_model)) fail("RESPONSE_SCHEMA_INVALID");
  return {
    kind: "success", source: "spy-analytics", status: "ready", generated_at: body.generated_at, window_days: 30,
    offers_observed: body.offers_observed, readings_observed: body.readings_observed,
    distinct_reading_days: body.distinct_reading_days, ready_to_model: body.ready_to_model,
  };
}

function unavailable(code = "SUMMARY_UNAVAILABLE") {
  return { kind: "unavailable", source: "UNAVAILABLE", status: "UNAVAILABLE", code, generated_at: null, window_days: null, offers_observed: null, readings_observed: null, distinct_reading_days: null, ready_to_model: null };
}

export function emptySpyAnalyticsSummary() {
  return { kind: "disabled", source: "UNVERIFIED", status: "UNVERIFIED", code: "SUMMARY_DISABLED", generated_at: null, window_days: null, offers_observed: null, readings_observed: null, distinct_reading_days: null, ready_to_model: null };
}

export async function fetchSpyAnalyticsSummary(options = {}) {
  const config = configFrom(options.config);
  if (config.enabled !== true && config.enabled !== "true") return emptySpyAnalyticsSummary();
  try {
    const url = validateUrl(config.url, config.hostAllowlist);
    if (typeof config.secret !== "string" || !config.secret) fail("SUMMARY_SECRET_MISSING");
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "error", signal: controller.signal, headers: { authorization: `Bearer ${config.secret}` } });
      if (!response.ok) return unavailable(response.status >= 400 && response.status < 500 ? "SUMMARY_REQUEST_INVALID" : "SUMMARY_UNAVAILABLE");
      let body;
      try { body = JSON.parse(await readResponse(response)); } catch (error) { if (error instanceof SpyAnalyticsSummaryError) throw error; fail("RESPONSE_JSON_INVALID"); }
      return normalizeSpyAnalyticsSummary(body);
    } finally { clearTimeout(timer); }
  } catch (error) {
    if (error instanceof SpyAnalyticsSummaryError) return unavailable(error.code);
    return unavailable(error?.name === "AbortError" ? "SUMMARY_TIMEOUT" : "SUMMARY_UNAVAILABLE");
  }
}

export const getSpyAnalyticsSummary = fetchSpyAnalyticsSummary;
