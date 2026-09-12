// Proxy server-only do fluxo guiado de funis. O browser fala somente com a rota
// same-origin do Banco; as credenciais Basic do painel externo ficam neste lado.
// Segue as proteções do analytics-client.mjs: origem fechada, HTTPS, redirect
// manual, timeout curto, corpo limitado e validação campo a campo.

import { QUIZ_ANALYTICS_ORIGIN } from "./analytics-client.mjs";

export const QUIZ_DASHBOARD_PROJECTS_PATH = "/api/dashboard/projects";

const MAX_RESPONSE_BYTES = 512 * 1024;
export const MAX_PROVISION_REQUEST_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_TIMEOUT_MS = 8000;
const MAX_PROJECTS = 250;
const PROJECT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FUNNEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const PAGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const PUBLIC_KEY_RE = /^pk_[A-Za-z0-9_-]{32}$/;

export class QuizFunnelProxyError extends Error {
  constructor(code) {
    super(code);
    this.name = "QuizFunnelProxyError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new QuizFunnelProxyError(code);
};

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value, max = Infinity) {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;
}

function isProjectId(value) {
  return isNonEmptyString(value, 64) && PROJECT_ID_RE.test(value);
}

function isFunnelId(value) {
  return isNonEmptyString(value, 64) && FUNNEL_ID_RE.test(value);
}

function isPageId(value) {
  return isNonEmptyString(value, 64) && PAGE_ID_RE.test(value);
}

function isHttpsUrl(value, max = 2048) {
  if (!isNonEmptyString(value, max) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function isHttpsOrigin(value) {
  if (!isNonEmptyString(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.pathname.replace(/^\/$/, "") && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function configFrom(options = {}) {
  const requestedTimeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const defaultHost = new URL(QUIZ_ANALYTICS_ORIGIN).hostname.toLowerCase();
  return {
    origin: options.origin ?? QUIZ_ANALYTICS_ORIGIN,
    hostAllowlist: options.hostAllowlist ?? [defaultHost],
    username: options.username ?? process.env.QUIZ_DASHBOARD_USERNAME ?? "",
    password: options.password ?? process.env.QUIZ_DASHBOARD_PASSWORD ?? "",
    timeoutMs: Number.isFinite(requestedTimeout)
      ? Math.min(MAX_TIMEOUT_MS, Math.max(1, requestedTimeout))
      : DEFAULT_TIMEOUT_MS,
  };
}

function buildUrl(config, projectId = null) {
  let origin;
  try {
    origin = new URL(config.origin);
  } catch {
    fail("BASE_URL_INVALID");
  }
  const allowedHosts = Array.isArray(config.hostAllowlist)
    ? config.hostAllowlist.filter((host) => typeof host === "string").map((host) => host.toLowerCase())
    : [];
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    !allowedHosts.includes(origin.hostname.toLowerCase())
  ) {
    fail("BASE_URL_INVALID");
  }
  const url = new URL(QUIZ_DASHBOARD_PROJECTS_PATH, origin.origin);
  if (projectId !== null) {
    if (!isProjectId(projectId)) fail("REQUEST_INVALID");
    url.searchParams.set("project_id", projectId);
  }
  return url;
}

async function readBoundedText(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
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
    if (error instanceof QuizFunnelProxyError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Lê um JSON de Request sem deixar o runtime materializar um corpo arbitrário.
 * A rota usa isto antes do Zod: Content-Length é uma rejeição antecipada, mas o
 * stream continua sendo limitado porque esse cabeçalho é controlado pelo cliente.
 */
export async function readBoundedJsonRequest(request, maxBytes = MAX_PROVISION_REQUEST_BYTES) {
  const contentLength = request.headers?.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { kind: "invalid" };
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared)) return { kind: "invalid" };
    if (declared > maxBytes) return { kind: "too_large" };
  }

  const body = request.body;
  if (!body || typeof body.getReader !== "function") return { kind: "invalid" };
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) return { kind: "invalid" };
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { kind: "too_large" };
      }
      chunks.push(part.value);
    }
  } catch {
    return { kind: "invalid" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { kind: "ok", value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { kind: "invalid" };
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    fail("RESPONSE_JSON_INVALID");
  }
}

function nullableString(value, max = 2048) {
  if (value === null) return null;
  if (!isNonEmptyString(value, max)) fail("RESPONSE_SCHEMA_INVALID");
  return value;
}

function nullablePositiveInteger(value) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) fail("RESPONSE_SCHEMA_INVALID");
  return value;
}

function validateProjectSummary(value) {
  if (!isPlainObject(value)) fail("RESPONSE_SCHEMA_INVALID");
  if (!isProjectId(value.project_id) || !isFunnelId(value.funnel_id) || !isNonEmptyString(value.name, 120)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  if (typeof value.test_pilot !== "boolean" || !isNonEmptyString(value.state, 64)) fail("RESPONSE_SCHEMA_INVALID");
  if (value.final_url !== null && !isHttpsUrl(value.final_url)) fail("RESPONSE_SCHEMA_INVALID");
  if (value.origin !== null && !isHttpsOrigin(value.origin)) fail("RESPONSE_SCHEMA_INVALID");
  return {
    project_id: value.project_id,
    name: value.name,
    funnel_id: value.funnel_id,
    offer_id: nullableString(value.offer_id, 128),
    banco_offer_tracking_id: nullablePositiveInteger(value.banco_offer_tracking_id),
    test_pilot: value.test_pilot,
    state: value.state,
    final_url: value.final_url,
    origin: value.origin,
    deployed_at: value.deployed_at === null ? null : nullableString(value.deployed_at, 64),
    first_event_at: value.first_event_at === null ? null : nullableString(value.first_event_at, 64),
  };
}

function canonicalTrackerSnippet(expectedOrigin, pageId, publicKey) {
  return [
    "<script",
    "  defer",
    `  src="${expectedOrigin}/assets/tracker.js"`,
    `  data-nga-page-id="${pageId}"`,
    `  data-nga-endpoint="${expectedOrigin}/api/track"`,
    `  data-nga-public-key="${publicKey}"`,
    "></script>",
  ].join("\n");
}

function validateInstallationPage(value, expectedOrigin, publicKey) {
  if (!isPlainObject(value)) fail("RESPONSE_SCHEMA_INVALID");
  const allowedRoles = new Set(["quiz", "presell", "vsl", "page"]);
  if (
    !isNonEmptyString(value.label, 120) ||
    !isHttpsUrl(value.url) ||
    !allowedRoles.has(value.role) ||
    !isPageId(value.page_id)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  // O upstream pode devolver um snippet para o dashboard próprio dele, mas nunca
  // o repassamos. Assim não há como uma resposta comprometida injetar atributos,
  // outro host ou conteúdo entre as tags no Banco.
  return {
    label: value.label,
    url: value.url,
    role: value.role,
    page_id: value.page_id,
    snippet: canonicalTrackerSnippet(expectedOrigin, value.page_id, publicKey),
  };
}

function validateProjectDetail(value, expectedOrigin) {
  if (!isPlainObject(value) || !isPlainObject(value.project) || !isPlainObject(value.installation)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  const project = value.project;
  if (
    !isProjectId(project.project_id) ||
    !isFunnelId(project.funnel_id) ||
    !isNonEmptyString(project.name, 120) ||
    !PUBLIC_KEY_RE.test(project.public_key) ||
    !isNonEmptyString(project.state, 64) ||
    !isHttpsUrl(project.final_url) ||
    !Array.isArray(project.allowed_origins) ||
    !project.allowed_origins.every(isHttpsOrigin) ||
    !isPageId(project.page_id) ||
    !(project.format === "quiz" || project.format === "presell" || project.format === "")
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  const installation = value.installation;
  // O alias público do upstream pode diferir da origem canônica configurada no
  // Banco. Os URLs de instalação nunca atravessam esse proxy: só precisamos da
  // lista de páginas, e reconstruímos os dois endpoints a partir da origem já
  // validada do próprio Banco.
  if (!Array.isArray(installation.pages)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  if (installation.pages.length < 1 || installation.pages.length > 100) fail("RESPONSE_SCHEMA_INVALID");
  return {
    project: {
      project_id: project.project_id,
      name: project.name,
      funnel_id: project.funnel_id,
      offer_id: nullableString(project.offer_id, 128),
      banco_offer_tracking_id: nullablePositiveInteger(project.banco_offer_tracking_id),
      test_pilot: project.test_pilot === true,
      state: project.state,
      final_url: project.final_url,
      allowed_origins: project.allowed_origins,
      page_id: project.page_id,
      format: project.format,
      public_key: project.public_key,
    },
    installation: {
      tracker_url: `${expectedOrigin}/assets/tracker.js`,
      track_url: `${expectedOrigin}/api/track`,
      pages: installation.pages.map((page) => validateInstallationPage(page, expectedOrigin, project.public_key)),
    },
  };
}

function upstreamError(status) {
  if (status === 401 || status === 403) return "UPSTREAM_UNAUTHORIZED";
  if (status === 429) return "UPSTREAM_RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_ERROR";
  if (status === 400 || status === 409 || status === 415 || status === 422) return "UPSTREAM_REQUEST_REJECTED";
  return "UPSTREAM_UNAVAILABLE";
}

/**
 * @typedef {{ url: string }} QuizFunnelPageInput
 * @typedef {{ name: string, format: "quiz" | "presell", pages: QuizFunnelPageInput[] }} QuizFunnelProvisionInput
 */

/**
 * Faz GET/POST no painel externo e retorna somente o subconjunto seguro que a
 * UI do Banco precisa. Não lança para falhas operacionais: rota recebe um código
 * tipado, sem credenciais, URL autenticada ou corpo bruto do upstream.
 *
 * @param {{ method: "GET" | "POST", projectId?: string | null, payload?: QuizFunnelProvisionInput | null }} request
 * @param {{ origin?: string, hostAllowlist?: string[], username?: string, password?: string, timeoutMs?: number, fetchImpl?: typeof fetch }} options
 */
export async function proxyQuizDashboardProjects({ method, projectId = null, payload = null } = {}, options = {}) {
  const config = configFrom(options);
  if (!config.username || !config.password) return { ok: false, code: "MISSING_CREDENTIALS" };
  if (method !== "GET" && method !== "POST") return { ok: false, code: "METHOD_NOT_ALLOWED" };

  try {
    const url = buildUrl(config, projectId);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const basicAuth = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
      const upstreamPayload = method === "POST" ? buildUpstreamProvisionPayload(payload) : null;
      const response = await fetchImpl(url, {
        method,
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          authorization: `Basic ${basicAuth}`,
          accept: "application/json",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(upstreamPayload) } : {}),
      });
      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        return { ok: false, code: "UNEXPECTED_REDIRECT" };
      }
      if (!response.ok) return { ok: false, code: upstreamError(response.status) };

      const body = parseJson(await readBoundedText(response));
      const expectedOrigin = new URL(config.origin).origin;
      if (method === "GET" && projectId === null) {
        if (!isPlainObject(body) || body.ok !== true || typeof body.provisioning_enabled !== "boolean" || !Array.isArray(body.projects)) {
          fail("RESPONSE_SCHEMA_INVALID");
        }
        if (body.projects.length > MAX_PROJECTS) fail("RESPONSE_SCHEMA_INVALID");
        return {
          ok: true,
          data: {
            provisioning_enabled: body.provisioning_enabled,
            projects: body.projects.map(validateProjectSummary),
          },
        };
      }

      const detail = validateProjectDetail(body, expectedOrigin);
      if (projectId !== null && detail.project.project_id !== projectId) fail("RESPONSE_FILTER_MISMATCH");
      return { ok: true, data: detail };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof QuizFunnelProxyError) return { ok: false, code: error.code };
    if (error?.name === "AbortError") return { ok: false, code: "TIMEOUT" };
    return { ok: false, code: "NETWORK_ERROR" };
  }
}

function buildUpstreamProvisionPayload(payload) {
  if (!isPlainObject(payload) || !isNonEmptyString(payload.name, 120) || !(payload.format === "quiz" || payload.format === "presell") || !Array.isArray(payload.pages)) {
    fail("REQUEST_INVALID");
  }
  if (payload.pages.length < 2 || payload.pages.length > 100) fail("REQUEST_INVALID");
  // O formulário guiado só recebe URLs. A versão hoje em produção do serviço
  // externo ainda exige label no contrato v2, então o Banco o gera de forma
  // determinística; role fica ausente para o upstream derivar pelo formato/ordem.
  const lastIndex = payload.pages.length - 1;
  const pages = payload.pages.map((page, index) => {
    if (!isPlainObject(page) || !isHttpsUrl(page.url)) fail("REQUEST_INVALID");
    const label = index === lastIndex ? "VSL" : payload.format === "presell" ? "Presell" : index === 0 ? "Quiz" : `Quiz etapa ${index + 1}`;
    return { label, url: page.url };
  });
  return { schema_version: 2, name: payload.name, format: payload.format, pages };
}
