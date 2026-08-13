export const QUIZ_ANALYTICS_SUMMARY_PATH = "/api/admin/projects/summary";
export const MAX_QUIZ_ANALYTICS_SUMMARY_BYTES = 256 * 1024;
export const MAX_QUIZ_ANALYTICS_PROJECTS = 500;

const MAX_TEXT = 240;

export class QuizAnalyticsSummaryError extends Error {
  constructor(code) { super(code); this.name = "QuizAnalyticsSummaryError"; this.code = code; }
}

const EMPTY_COUNTS = Object.freeze({ awaiting_deploy: 0, installed: 0, receiving_events: 0 });
const fail = (code) => { throw new QuizAnalyticsSummaryError(code); };

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
    enabled: options.enabled ?? process.env.OPERATION_QUIZ_ANALYTICS_ENABLED ?? false,
    url: options.url ?? process.env.OPERATION_QUIZ_ANALYTICS_SUMMARY_URL ?? "",
    secret: options.secret ?? process.env.OPERATION_QUIZ_ANALYTICS_SUMMARY_SECRET ?? "",
    hostAllowlist: options.hostAllowlist ?? process.env.OPERATION_QUIZ_ANALYTICS_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(3000, Math.max(1, timeout)) : 3000,
  };
}

function validateUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw) fail("SUMMARY_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("SUMMARY_URL_INVALID"); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password
    || url.search || url.hash || url.pathname !== QUIZ_ANALYTICS_SUMMARY_PATH) fail("SUMMARY_URL_INVALID");
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
      if (total > MAX_QUIZ_ANALYTICS_SUMMARY_BYTES) { await reader.cancel().catch(() => undefined); fail("RESPONSE_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof QuizAnalyticsSummaryError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function iso(value, nullable = false) {
  return (nullable && value === null) || (typeof value === "string" && value.length <= 64
    && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value)));
}

function text(value, nullable = false) {
  return (nullable && value === null) || (typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT);
}

function validateProject(project) {
  const keys = ["project_id", "name", "funnel_id", "offer_id", "banco_offer_tracking_id", "test_pilot", "state", "final_url", "deployed_at", "first_event_at"];
  if (!isPlainObject(project) || Object.keys(project).some((key) => !keys.includes(key)) || !keys.every((key) => Object.hasOwn(project, key))) fail("RESPONSE_SCHEMA_INVALID");
  if (!text(project.project_id) || !text(project.name) || !text(project.funnel_id, true) || !text(project.offer_id, true)
    || !(project.banco_offer_tracking_id === null || Number.isInteger(project.banco_offer_tracking_id)) || typeof project.test_pilot !== "boolean"
    || !text(project.state) || !text(project.final_url, true) || !iso(project.deployed_at, true) || !iso(project.first_event_at, true)) fail("RESPONSE_SCHEMA_INVALID");
  if (project.final_url !== null) {
    let url;
    try { url = new URL(project.final_url); } catch { fail("RESPONSE_SCHEMA_INVALID"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) fail("RESPONSE_SCHEMA_INVALID");
  }
  return project;
}

export function normalizeQuizAnalyticsSummary(body, { knownBancoOfferTrackingIds = [] } = {}) {
  if (!isPlainObject(body) || Object.keys(body).some((key) => !["schema_version", "generated_at", "projects"].includes(key))
    || body.schema_version !== 1 || !iso(body.generated_at) || !Array.isArray(body.projects) || body.projects.length > MAX_QUIZ_ANALYTICS_PROJECTS) fail("RESPONSE_SCHEMA_INVALID");
  const knownIds = new Set(knownBancoOfferTrackingIds.filter((id) => Number.isInteger(id) && id > 0));
  const knownIdCounts = new Map();
  for (const id of knownBancoOfferTrackingIds) if (Number.isInteger(id) && id > 0) knownIdCounts.set(id, (knownIdCounts.get(id) ?? 0) + 1);
  const projects = body.projects.map(validateProject);
  const idCounts = new Map();
  for (const project of projects) if (Number.isInteger(project.banco_offer_tracking_id)) idCounts.set(project.banco_offer_tracking_id, (idCounts.get(project.banco_offer_tracking_id) ?? 0) + 1);
  const projected = projects.map((project) => ({
    project_id: project.project_id,
    state: project.state,
    banco_offer_tracking_id: project.banco_offer_tracking_id,
    banco_offer_tracking_link: Number.isInteger(project.banco_offer_tracking_id) && project.banco_offer_tracking_id > 0
      && knownIds.has(project.banco_offer_tracking_id) && knownIdCounts.get(project.banco_offer_tracking_id) === 1
      && idCounts.get(project.banco_offer_tracking_id) === 1 && !project.test_pilot ? "CONFIRMED" : "PENDING",
  }));
  const counts = { ...EMPTY_COUNTS };
  for (const project of projected) if (Object.hasOwn(counts, project.state)) counts[project.state] += 1;
  return { kind: "success", source: "EXTERNAL_READ_ONLY", generated_at: body.generated_at, projects: projected, counts };
}

function unavailable(code = "SUMMARY_UNAVAILABLE") {
  return { kind: "unavailable", source: "UNAVAILABLE", code, generated_at: null, projects: [], counts: { ...EMPTY_COUNTS } };
}

export function emptyQuizAnalyticsSummary() {
  return { kind: "disabled", source: "UNVERIFIED", code: "SUMMARY_DISABLED", generated_at: null, projects: [], counts: { ...EMPTY_COUNTS } };
}

export async function fetchQuizAnalyticsSummary(options = {}) {
  const config = configFrom(options.config);
  if (config.enabled !== true && config.enabled !== "true") return emptyQuizAnalyticsSummary();
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
      try { body = JSON.parse(await readResponse(response)); } catch (error) { if (error instanceof QuizAnalyticsSummaryError) throw error; fail("RESPONSE_JSON_INVALID"); }
      return normalizeQuizAnalyticsSummary(body, { knownBancoOfferTrackingIds: options.knownBancoOfferTrackingIds });
    } finally { clearTimeout(timer); }
  } catch (error) {
    if (error instanceof QuizAnalyticsSummaryError) return unavailable(error.code);
    return unavailable(error?.name === "AbortError" ? "SUMMARY_TIMEOUT" : "SUMMARY_UNAVAILABLE");
  }
}

export const getQuizAnalyticsSummary = fetchQuizAnalyticsSummary;
