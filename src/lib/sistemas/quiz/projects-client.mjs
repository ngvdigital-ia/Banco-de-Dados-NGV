// Núcleo testável do adapter Banco -> Funnel Analytics para o seletor e o
// provisioning de funis. Ele não lê process.env: a credencial é injetada pelo
// wrapper projects.ts, que importa `server-only`. Assim, username/password não
// podem atravessar a fronteira do Server Action para o navegador.
//
// O origin é a mesma constante canônica usada pelo adapter de analytics. Não
// aceitamos URL vinda de formulário, query string ou env: isso evita que uma
// configuração errada transforme Basic Auth em um pedido para outro host.

import { QUIZ_ANALYTICS_ORIGIN } from "./analytics-client.mjs";

export const QUIZ_DASHBOARD_PROJECTS_PATH = "/api/dashboard/projects";
const MAX_RESPONSE_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_TIMEOUT_MS = 8000;

export class QuizDashboardProjectsError extends Error {
  constructor(code) {
    super(code);
    this.name = "QuizDashboardProjectsError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new QuizDashboardProjectsError(code);
};

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isTrimmedNonEmptyString(value, max = 2048) {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;
}

function isSlug(value) {
  return isTrimmedNonEmptyString(value, 64) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isIdentifier(value, max = 64) {
  return isTrimmedNonEmptyString(value, max) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function isIsoOrNull(value) {
  return value === null || (typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value)));
}

function isHttpsUrl(value) {
  if (!isTrimmedNonEmptyString(value, 2048)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash && !parsed.port;
  } catch {
    return false;
  }
}

function originFor(finalUrl) {
  return new URL(finalUrl).origin;
}

function normalizeTimeout(raw) {
  const timeout = Number(raw ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, timeout)) : DEFAULT_TIMEOUT_MS;
}

function resultError(code) {
  return { kind: "error", code, receivedAt: null, data: null };
}

function notConfigured(reason) {
  return { kind: "not_configured", reason, receivedAt: null, data: null };
}

function buildUrl() {
  // `QUIZ_ANALYTICS_ORIGIN` é um literal versionado e já usado pelo adapter de
  // leitura. Ainda assim validamos a forma para falhar fechado numa alteração
  // acidental da constante, antes de preparar o Authorization header.
  let base;
  try {
    base = new URL(QUIZ_ANALYTICS_ORIGIN);
  } catch {
    fail("BASE_URL_INVALID");
  }
  if (
    base.protocol !== "https:"
    || base.username
    || base.password
    || base.pathname !== "/"
    || base.search
    || base.hash
  ) {
    fail("BASE_URL_INVALID");
  }
  return new URL(QUIZ_DASHBOARD_PROJECTS_PATH, base.origin);
}

async function readBoundedText(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) fail("RESPONSE_TOO_LARGE");
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) fail("RESPONSE_BODY_UNREADABLE");
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    if (error instanceof QuizDashboardProjectsError) throw error;
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

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    fail("RESPONSE_JSON_INVALID");
  }
}

function validateLink(raw) {
  if (raw === null) return null;
  if (!Number.isSafeInteger(raw) || raw <= 0) fail("RESPONSE_SCHEMA_INVALID");
  return raw;
}

function validateProjectSummary(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const {
    project_id,
    name,
    funnel_id,
    offer_id,
    banco_offer_tracking_id,
    test_pilot,
    state,
    final_url,
    origin,
    deployed_at,
    first_event_at,
  } = input;

  if (
    !isSlug(project_id)
    || !isTrimmedNonEmptyString(name, 120)
    || !isIdentifier(funnel_id)
    || !(offer_id === null || isTrimmedNonEmptyString(offer_id, 68))
    || typeof test_pilot !== "boolean"
    || !isTrimmedNonEmptyString(state, 64)
    || !(final_url === null || isHttpsUrl(final_url))
    || !(origin === null || isHttpsUrl(origin))
    || !isIsoOrNull(deployed_at)
    || !isIsoOrNull(first_event_at)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }

  const bancoOfferTrackingId = validateLink(banco_offer_tracking_id);
  if ((bancoOfferTrackingId === null) !== test_pilot) fail("RESPONSE_SCHEMA_INVALID");
  if (final_url !== null && origin !== null && originFor(final_url) !== origin) fail("RESPONSE_SCHEMA_INVALID");

  // Projeção explícita: chaves extras do upstream (inclusive public_key que
  // não deveria existir no GET) jamais atravessam esta lista autorizada.
  return {
    projectId: project_id,
    name,
    funnelId: funnel_id,
    offerId: offer_id,
    bancoOfferTrackingId,
    testPilot: test_pilot,
    state,
    finalUrl: final_url,
    origin,
    deployedAt: deployed_at,
    firstEventAt: first_event_at,
  };
}

export function parseQuizDashboardProjectsPayload(input) {
  if (!isPlainObject(input) || input.ok !== true || typeof input.provisioning_enabled !== "boolean" || !Array.isArray(input.projects)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  if (input.projects.length > 500) fail("RESPONSE_SCHEMA_INVALID");
  return {
    provisioningEnabled: input.provisioning_enabled,
    projects: input.projects.map(validateProjectSummary),
  };
}

function validateAllowedOrigins(input, finalUrl) {
  if (!Array.isArray(input) || input.length !== 1 || !isHttpsUrl(input[0])) fail("RESPONSE_SCHEMA_INVALID");
  if (input[0] !== originFor(finalUrl)) fail("RESPONSE_SCHEMA_INVALID");
  return [input[0]];
}

function validateStep(input, index) {
  if (!isPlainObject(input) || !isIdentifier(input.id) || !isTrimmedNonEmptyString(input.label, 120) || input.index !== index) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return { id: input.id, label: input.label, index };
}

function validateProvisionProject(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const {
    project_id,
    name,
    funnel_id,
    offer_id,
    banco_offer_tracking_id,
    test_pilot,
    public_key,
    public_key_prefix,
    state,
    final_url,
    allowed_origins,
    page_id,
    steps,
  } = input;
  if (
    !isSlug(project_id)
    || !isTrimmedNonEmptyString(name, 120)
    || !isIdentifier(funnel_id)
    || offer_id !== `ngv:${project_id}`
    || typeof test_pilot !== "boolean"
    || !isTrimmedNonEmptyString(public_key, 200)
    || !/^pk_[A-Za-z0-9_-]+$/.test(public_key)
    || !isTrimmedNonEmptyString(public_key_prefix, 200)
    || !public_key.startsWith(public_key_prefix)
    || !isTrimmedNonEmptyString(state, 64)
    || !isHttpsUrl(final_url)
    || !isIdentifier(page_id)
    || !Array.isArray(steps)
    || steps.length === 0
    || steps.length > 100
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  const bancoOfferTrackingId = validateLink(banco_offer_tracking_id);
  if ((bancoOfferTrackingId === null) !== test_pilot) fail("RESPONSE_SCHEMA_INVALID");
  return {
    projectId: project_id,
    name,
    funnelId: funnel_id,
    offerId: offer_id,
    bancoOfferTrackingId,
    testPilot: test_pilot,
    publicKey: public_key,
    publicKeyPrefix: public_key_prefix,
    state,
    finalUrl: final_url,
    allowedOrigins: validateAllowedOrigins(allowed_origins, final_url),
    pageId: page_id,
    steps: steps.map(validateStep),
  };
}

function validateInstallation(input, project) {
  if (!isPlainObject(input) || input.type !== "ngv.analytics.tracker" || input.version !== 1 || !isHttpsUrl(input.tracker_url) || !isHttpsUrl(input.track_url) || !isPlainObject(input.attributes)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  const attributes = input.attributes;
  if (
    attributes["data-nga-project-id"] !== project.projectId
    || attributes["data-nga-funnel-id"] !== project.funnelId
    || attributes["data-nga-page-id"] !== project.pageId
    || attributes["data-nga-endpoint"] !== input.track_url
    || attributes["data-nga-public-key"] !== project.publicKey
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return {
    trackerUrl: input.tracker_url,
    trackUrl: input.track_url,
    attributes: {
      projectId: project.projectId,
      funnelId: project.funnelId,
      pageId: project.pageId,
      endpoint: input.track_url,
      publicKey: project.publicKey,
    },
  };
}

export function parseQuizDashboardProvisionPayload(input) {
  if (!isPlainObject(input) || input.ok !== true) fail("RESPONSE_SCHEMA_INVALID");
  const project = validateProvisionProject(input.project);
  return { project, installation: validateInstallation(input.installation, project) };
}

function slugifyName(name) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || null;
}

export function deriveQuizProvisionPayload(input) {
  if (!isPlainObject(input) || !isTrimmedNonEmptyString(input.name, 120) || !isHttpsUrl(input.finalUrl)) {
    fail("PROVISION_INPUT_INVALID");
  }
  const projectId = slugifyName(input.name);
  if (!projectId) fail("PROVISION_INPUT_INVALID");

  const bancoOfferTrackingId = input.bancoOfferTrackingId ?? null;
  if (bancoOfferTrackingId !== null && (!Number.isSafeInteger(bancoOfferTrackingId) || bancoOfferTrackingId <= 0)) {
    fail("PROVISION_INPUT_INVALID");
  }

  // O formulário nunca recebe IDs. Esta é a única derivação compatível com o
  // contrato do upstream; `format` não é enviado nem persistido como tipo do
  // funil. A página inicial neutra mantém essa escolha como orientação da UI.
  return {
    schema_version: 1,
    name: input.name,
    slug: projectId,
    funnel_id: "principal",
    offer_id: `ngv:${projectId}`,
    banco_offer_tracking_id: bancoOfferTrackingId,
    ...(bancoOfferTrackingId === null ? { test_pilot: true } : {}),
    final_url: input.finalUrl,
    page_id: "pagina-inicial",
    steps: [{ id: "pagina-inicial", label: "Página inicial", index: 0 }],
  };
}

async function requestProjects(method, body, options = {}) {
  const username = typeof options.username === "string" ? options.username : "";
  const password = typeof options.password === "string" ? options.password : "";
  if (!username || !password) return notConfigured("MISSING_CREDENTIALS");

  let url;
  try {
    url = buildUrl();
  } catch (error) {
    return error instanceof QuizDashboardProjectsError ? resultError(error.code) : resultError("BASE_URL_INVALID");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") return resultError("FETCH_UNAVAILABLE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), normalizeTimeout(options.timeoutMs));
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        authorization: `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return resultError("UNEXPECTED_REDIRECT");
    }
    if (response.status === 401 || response.status === 403) return resultError("UNAUTHORIZED");
    if (response.status === 409) return resultError(method === "POST" ? "CONFLICT" : "UPSTREAM_ERROR");
    if (!response.ok) return resultError("UPSTREAM_ERROR");

    const payload = parseJson(await readBoundedText(response));
    return { kind: "success", receivedAt: new Date().toISOString(), data: payload };
  } catch (error) {
    if (error instanceof QuizDashboardProjectsError) return resultError(error.code);
    if (error && typeof error === "object" && error.name === "AbortError") return resultError("TIMEOUT");
    return resultError("NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuizDashboardProjects(options = {}) {
  const response = await requestProjects("GET", undefined, options);
  if (response.kind !== "success") return response;
  try {
    return { ...response, data: parseQuizDashboardProjectsPayload(response.data) };
  } catch (error) {
    return error instanceof QuizDashboardProjectsError ? resultError(error.code) : resultError("RESPONSE_SCHEMA_INVALID");
  }
}

export async function provisionQuizDashboardProject(input, options = {}) {
  let body;
  try {
    body = deriveQuizProvisionPayload(input);
  } catch (error) {
    return error instanceof QuizDashboardProjectsError ? resultError(error.code) : resultError("PROVISION_INPUT_INVALID");
  }
  const response = await requestProjects("POST", body, options);
  if (response.kind !== "success") return response;
  try {
    return { ...response, data: parseQuizDashboardProvisionPayload(response.data) };
  } catch (error) {
    return error instanceof QuizDashboardProjectsError ? resultError(error.code) : resultError("RESPONSE_SCHEMA_INVALID");
  }
}
