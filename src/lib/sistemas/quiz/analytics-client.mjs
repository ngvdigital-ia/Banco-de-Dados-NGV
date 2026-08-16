// Adapter server-to-server pro módulo Quiz dentro do Banco NGV (Fase 2).
// Sem `import "server-only"` aqui de propósito — mesma convenção dos demais adapters
// .mjs de src/lib/operacao/ (ex.: quiz-analytics-summary.mjs, ngv-core-summary.mjs):
// nenhum deles importa server-only, pra permanecerem testáveis via `node --test` sem
// runtime React. Quem importa este módulo é sempre um Server Component/Server Action
// que já está atrás de "server-only" na própria cadeia (ex.: src/lib/sistemas/authz.ts).
// ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 4: segue a receita já validada
// em src/lib/operacao/quiz-analytics-summary.mjs (host allowlist, secret não-NEXT_PUBLIC,
// timeout curto, redirect não seguido, resposta validada campo a campo) — mas aponta pro
// endpoint que EXISTE de verdade: GET /api/analytics (Basic Auth), não /api/admin/projects/summary
// (404, registrado como pendência aberta na Decisão 4, não usado aqui).
//
// Contrato do endpoint real confirmado em workspaces/ofertas-ngv/quiz-analytics/server.js
// (função analytics(), ~linha 356) + supabase/migrations/20260809000001_ngv_analytics_journeys.sql
// (RPC quiz_analytics/ngv_analytics_journeys) nesta sessão — não de memória.

export const QUIZ_ANALYTICS_PATH = "/api/analytics";
const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_TIMEOUT_MS = 8000;

// Host allowlist HARDCODED (ADR Decisão 4) — não vem de env, então uma env mal
// configurada nunca amplia o alcance do adapter. Único host de produção do Quiz,
// confirmado no ADR (Decisão 5, "painel antigo continua no ar") e no snippet do
// tracker em dashboard.js.
const QUIZ_ANALYTICS_ORIGIN = "https://quiz-analytics-phi.vercel.app";

export class QuizModuleAnalyticsError extends Error {
  constructor(code) {
    super(code);
    this.name = "QuizModuleAnalyticsError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new QuizModuleAnalyticsError(code);
};

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isIsoString(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function notConfigured(reason) {
  return { kind: "not_configured", reason, generatedAt: null, data: null };
}

function errorResult(code) {
  return { kind: "error", code, generatedAt: null, data: null };
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return {
    origin: options.origin ?? QUIZ_ANALYTICS_ORIGIN,
    username: options.username ?? process.env.QUIZ_DASHBOARD_USERNAME ?? "",
    password: options.password ?? process.env.QUIZ_DASHBOARD_PASSWORD ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, timeout)) : DEFAULT_TIMEOUT_MS,
  };
}

function buildUrl(originStr, filters = {}) {
  let origin;
  try {
    origin = new URL(originStr);
  } catch {
    fail("BASE_URL_INVALID");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password) fail("BASE_URL_INVALID");

  const url = new URL(QUIZ_ANALYTICS_PATH, origin.origin);
  const { projectId, funnelId, from, to } = filters;
  if (isNonEmptyString(projectId)) url.searchParams.set("project_id", projectId.slice(0, 120));
  if (isNonEmptyString(funnelId)) url.searchParams.set("funnel_id", funnelId.slice(0, 120));
  if (isIsoString(from)) url.searchParams.set("from", from);
  if (isIsoString(to)) url.searchParams.set("to", to);
  return url;
}

async function readBoundedText(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    // Ambiente sem streaming body (ex.: alguns polyfills de teste) — cai pra text() com o mesmo teto.
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) fail("RESPONSE_TOO_LARGE");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) fail("RESPONSE_BODY_UNREADABLE");
      total += part.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof QuizModuleAnalyticsError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
}

// --- Validação campo a campo do payload de GET /api/analytics (nunca JSON.parse cego) ---

function validateSummary(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { total_sessions, started, checkout_clicks, checkout_rate } = input;
  if (![total_sessions, started, checkout_clicks, checkout_rate].every(isFiniteNumber)) fail("RESPONSE_SCHEMA_INVALID");
  return { totalSessions: total_sessions, started, checkoutClicks: checkout_clicks, checkoutRate: checkout_rate };
}

function validateFunnelRow(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { id, label, count, overall_rate, prev_pass_rate, prev_drop_rate, prev_drop_count } = input;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(label) ||
    ![count, overall_rate, prev_pass_rate, prev_drop_rate, prev_drop_count].every(isFiniteNumber)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    id,
    label,
    count,
    overallRate: overall_rate,
    prevPassRate: prev_pass_rate,
    prevDropRate: prev_drop_rate,
    prevDropCount: prev_drop_count,
  };
}

function validateAnswer(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { label, count, pct } = input;
  if (typeof label !== "string" || !isFiniteNumber(count) || !isFiniteNumber(pct)) fail("RESPONSE_SCHEMA_INVALID");
  return { label, count, pct };
}

function validateResponseQuestion(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { id, label, stage_number, stage_label, multi, total_sessions, answers } = input;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(label) ||
    !(stage_number === null || isFiniteNumber(stage_number)) ||
    typeof stage_label !== "string" ||
    typeof multi !== "boolean" ||
    !isFiniteNumber(total_sessions) ||
    !Array.isArray(answers)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    id,
    label,
    stageNumber: stage_number,
    stageLabel: stage_label,
    multi,
    totalSessions: total_sessions,
    answers: answers.map(validateAnswer),
  };
}

function validateCampaign(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { campaign, sessions } = input;
  if (typeof campaign !== "string" || !isFiniteNumber(sessions)) fail("RESPONSE_SCHEMA_INVALID");
  return { campaign, sessions };
}

function validateEvent(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { event_name, screen_id, label, created_at, session_short, value } = input;
  if (
    !isNonEmptyString(event_name) ||
    !(screen_id === null || screen_id === undefined || typeof screen_id === "string") ||
    !(label === null || label === undefined || typeof label === "string") ||
    !isIsoString(created_at) ||
    !isNonEmptyString(session_short)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    eventName: event_name,
    screenId: screen_id ?? null,
    label: label ?? null,
    createdAt: created_at,
    sessionShort: session_short,
    value: value === undefined ? null : value,
  };
}

function validateJourneyPage(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { page_id, count } = input;
  if (typeof page_id !== "string" || !isFiniteNumber(count)) fail("RESPONSE_SCHEMA_INVALID");
  return { pageId: page_id, count };
}

function validateJourneys(input) {
  // Falha fechado como TODOS os outros campos do payload. A versão anterior tinha
  // `input ?? { ...zeros }`, e o gate held-out provou o furo: payload sem a chave
  // `journeys` (ou com `journeys: null`) virava kind:"success" com 0 jornadas, sem
  // nenhum sinal de erro — exatamente o "falha vira zero" que este módulo promete
  // não ter. O servidor real (quiz-analytics/server.js:398) sempre manda o objeto,
  // então rejeitar aqui não quebra o caminho feliz e transforma um schema quebrado
  // em erro visível em vez de dado silenciosamente errado.
  const value = input;
  if (!isPlainObject(value)) fail("RESPONSE_SCHEMA_INVALID");
  const { summary, pages } = value;
  if (
    !isPlainObject(summary) ||
    !isFiniteNumber(summary.total_journeys) ||
    !isFiniteNumber(summary.cross_page_journeys) ||
    !Array.isArray(pages)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    summary: { totalJourneys: summary.total_journeys, crossPageJourneys: summary.cross_page_journeys },
    pages: pages.map(validateJourneyPage),
  };
}

export function parseQuizModuleAnalyticsPayload(body) {
  if (!isPlainObject(body)) fail("RESPONSE_SCHEMA_INVALID");
  const { generated_at, summary, funnel, responses, utm_campaigns, recent_events, journeys } = body;
  if (!isIsoString(generated_at)) fail("RESPONSE_SCHEMA_INVALID");
  if (!Array.isArray(funnel) || !Array.isArray(responses) || !Array.isArray(utm_campaigns) || !Array.isArray(recent_events)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    generatedAt: generated_at,
    summary: validateSummary(summary),
    funnel: funnel.map(validateFunnelRow),
    responses: responses.map(validateResponseQuestion),
    utmCampaigns: utm_campaigns.map(validateCampaign),
    recentEvents: recent_events.map(validateEvent),
    journeys: validateJourneys(journeys),
  };
}

/**
 * Busca as 4 abas de leitura do Quiz (funil, respostas, eventos, jornadas) via
 * GET /api/analytics do Quiz. Nunca lança — sempre devolve um resultado tipado:
 *  - { kind: "not_configured", reason }  → credencial ausente neste ambiente
 *  - { kind: "error", code }             → falha (401/timeout/schema/etc), erro visível
 *  - { kind: "success", generatedAt, data } → payload validado campo a campo
 */
export async function fetchQuizModuleAnalytics(filters = {}, options = {}) {
  const config = configFrom(options);
  if (!config.username || !config.password) {
    return notConfigured("MISSING_CREDENTIALS");
  }

  try {
    const url = buildUrl(config.origin, filters);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");

    const basicAuth = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: { authorization: `Basic ${basicAuth}`, accept: "application/json" },
      });

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        return errorResult("UNEXPECTED_REDIRECT");
      }
      if (response.status === 401 || response.status === 403) return errorResult("UNAUTHORIZED");
      if (!response.ok) return errorResult(response.status >= 500 ? "UPSTREAM_ERROR" : "REQUEST_INVALID");

      const text = await readBoundedText(response);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        fail("RESPONSE_JSON_INVALID");
      }
      const data = parseQuizModuleAnalyticsPayload(body);
      return { kind: "success", generatedAt: data.generatedAt, data };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof QuizModuleAnalyticsError) return errorResult(error.code);
    if (error?.name === "AbortError") return errorResult("TIMEOUT");
    return errorResult("NETWORK_ERROR");
  }
}
