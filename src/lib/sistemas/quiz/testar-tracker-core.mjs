// Núcleo puro do Teste B (server-to-server) da aba "Instalar tracker" — dispara um OPTIONS
// REAL contra o quiz-analytics com o Origin do domínio do FUNIL (nunca o do painel) e devolve
// veredito traduzido pra linguagem de operador.
//
// NUNCA faz POST em /api/track. Confirmado nesta tarefa, lendo
// workspaces/ofertas-ngv/quiz-analytics/server.js inteiro: o tracker não tem modo de teste —
// um POST que passasse nas 3 allowlists gravaria de verdade em quiz_analytics_sessions,
// quiz_analytics_events e ngv_analytics_projects/pages/journeys, indistinguível de uma sessão
// real, sujando o funil/dashboard de cliente pra sempre. Por isso o Teste B só prova
// ANALYTICS_ALLOWED_ORIGINS (via OPTIONS, que só chama assertAllowedTrackOrigin — server.js
// linha ~441). ANALYTICS_ALLOWED_PROJECT_IDS e ANALYTICS_ALLOWED_FUNNEL_IDS não têm como ser
// verificados sem escrever, e a resposta abaixo DECLARA isso (checked:false) em vez de fingir
// um "ok" que na verdade não testou nada — inventar esse verde é exatamente o defeito que esta
// tarefa existe pra matar.
//
// PENDÊNCIA (registrada, não implementada aqui — outro projeto, outra decisão): falta um
// endpoint verify-only no quiz-analytics (ex.: GET /api/track/verify?project_id=&funnel_id=)
// que valide as 3 allowlists sem gravar nada.

import { QUIZ_ANALYTICS_ORIGIN } from "./analytics-client.mjs";

export const QUIZ_TRACK_PATH = "/api/track";
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 8 * 1024;

export const ANALYTICS_ALLOWED_ORIGINS_VAR = "ANALYTICS_ALLOWED_ORIGINS";
export const ANALYTICS_ALLOWED_PROJECT_IDS_VAR = "ANALYTICS_ALLOWED_PROJECT_IDS";
export const ANALYTICS_ALLOWED_FUNNEL_IDS_VAR = "ANALYTICS_ALLOWED_FUNNEL_IDS";

export class TestarTrackerError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "TestarTrackerError";
    this.code = code;
  }
}

/** @returns {never} */
function fail(code) {
  throw new TestarTrackerError(code);
}

function hosts(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function resolveTestarTrackerConfig(options = {}) {
  const requestedTimeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const trackerOrigin = options.trackerOrigin ?? QUIZ_ANALYTICS_ORIGIN;
  let defaultHost = "";
  try {
    defaultHost = new URL(trackerOrigin).hostname.toLowerCase();
  } catch {
    defaultHost = "";
  }
  return {
    trackerOrigin,
    hostAllowlist: options.hostAllowlist ?? (defaultHost ? [defaultHost] : []),
    timeoutMs: Number.isFinite(requestedTimeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, requestedTimeout)) : DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Valida a URL do tracker (fail-closed, molde de src/lib/ngv-core/emitter.mjs). Nunca vem de
 * input do operador — sempre de QUIZ_ANALYTICS_ORIGIN (ou de override explícito em teste).
 */
export function validateTrackerUrl(trackerOrigin, allowlistedHosts) {
  if (typeof trackerOrigin !== "string" || !trackerOrigin) fail("TRACKER_URL_INVALID");
  let origin;
  try {
    origin = new URL(trackerOrigin);
  } catch {
    fail("TRACKER_URL_INVALID");
  }
  if (
    origin.protocol !== "https:"
    || (origin.port && origin.port !== "443")
    || origin.username || origin.password
    || origin.search || origin.hash
  ) {
    fail("TRACKER_URL_INVALID");
  }
  if (!hosts(allowlistedHosts).includes(origin.hostname.toLowerCase())) fail("TRACKER_HOST_NOT_ALLOWLISTED");
  return new URL(QUIZ_TRACK_PATH, origin.origin);
}

/**
 * Domínio da página do funil digitado pelo operador → origin "bare" (sem path/query/hash).
 * Precisa casar BIT A BIT com `normalizedOrigin()` de quiz-analytics/server.js (mesma forma
 * `${protocol}//${host}`), porque é isso que o servidor real compara contra
 * ANALYTICS_ALLOWED_ORIGINS — qualquer divergência de forma vira um 403 "impossível de
 * resolver" mesmo com o valor certo cadastrado.
 */
export function normalizeFunnelOrigin(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  return `${url.protocol}//${url.host}`;
}

// ── Tradução do 403 → linguagem de operador (nunca "403 Forbidden" nu) ──────────────────

const FORBIDDEN_TRANSLATIONS = [
  {
    match: /ANALYTICS_ALLOWED_ORIGINS/,
    envVar: ANALYTICS_ALLOWED_ORIGINS_VAR,
    describe: (value) =>
      `A origem "${value}" não está em ANALYTICS_ALLOWED_ORIGINS na Vercel. Adicione esse valor exato à lista e faça redeploy.`,
  },
  {
    match: /ANALYTICS_ALLOWED_PROJECT_IDS/,
    envVar: ANALYTICS_ALLOWED_PROJECT_IDS_VAR,
    describe: (value) =>
      `O project_id "${value}" não está em ANALYTICS_ALLOWED_PROJECT_IDS na Vercel. Adicione esse valor exato à lista e faça redeploy.`,
  },
  {
    match: /ANALYTICS_ALLOWED_FUNNEL_IDS/,
    envVar: ANALYTICS_ALLOWED_FUNNEL_IDS_VAR,
    describe: (value) =>
      `O funnel_id "${value}" não está em ANALYTICS_ALLOWED_FUNNEL_IDS na Vercel. Adicione esse valor exato à lista e faça redeploy.`,
  },
];

/**
 * Traduz a mensagem 403 crua do quiz-analytics/server.js pra linguagem de operador,
 * nomeando qual das três allowlists barrou e o valor a colar. Uma mensagem desconhecida
 * cai num fallback que ainda assim nomeia as três — nunca devolve "403 Forbidden" nu.
 */
export function translateTrackerForbidden(rawMessage, value) {
  const text = typeof rawMessage === "string" ? rawMessage : "";
  for (const entry of FORBIDDEN_TRANSLATIONS) {
    if (entry.match.test(text)) {
      return { envVar: entry.envVar, message: entry.describe(value) };
    }
  }
  return {
    envVar: null,
    message:
      `O tracker recusou com 403 e a causa não bateu com nenhuma das três allowlists conhecidas ` +
      `(resposta: "${text || "sem corpo"}"). Confira ANALYTICS_ALLOWED_ORIGINS, ` +
      `ANALYTICS_ALLOWED_PROJECT_IDS e ANALYTICS_ALLOWED_FUNNEL_IDS na Vercel.`,
  };
}

async function readLimited(response, limit = MAX_BODY_BYTES) {
  if (!response?.body || typeof response.body.getReader !== "function") {
    const text = await response.text().catch(() => "");
    return text.slice(0, limit);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    chunks.push(part.value);
    if (total >= limit) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  const bytes = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = bytes.length - offset;
    if (remaining <= 0) break;
    bytes.set(chunk.subarray(0, remaining), offset);
    offset += Math.min(chunk.byteLength, remaining);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Dispara OPTIONS real contra `{tracker}/api/track` com `Origin: {funnelOrigin}` — o domínio
 * do FUNIL digitado pelo operador, nunca o do painel. Só testa ANALYTICS_ALLOWED_ORIGINS (ver
 * cabeçalho do arquivo pro porquê). Nunca lança por causa de rede/timeout/status — sempre
 * devolve um resultado tipado; só lança se a CONFIG (URL/allowlist do tracker) for inválida,
 * porque isso é erro de programação/deploy do painel, não do teste em si.
 */
export async function checkTrackerOrigin(funnelOrigin, options = {}) {
  const config = resolveTestarTrackerConfig(options);
  const url = validateTrackerUrl(config.trackerOrigin, config.hostAllowlist);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "OPTIONS",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { origin: funnelOrigin },
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return {
        checked: true,
        ok: false,
        code: "UNEXPECTED_REDIRECT",
        status: response.status ?? null,
        envVar: null,
        message: "O tracker respondeu com redirect em vez de liberar ou recusar a origem — configuração inesperada, não deu pra confirmar.",
      };
    }
    if (response.status === 403) {
      const rawBody = await readLimited(response);
      let rawMessage = rawBody;
      try {
        rawMessage = JSON.parse(rawBody)?.error ?? rawBody;
      } catch {
        // corpo não-JSON: usa o texto cru mesmo pra tentar casar a tradução
      }
      const translated = translateTrackerForbidden(rawMessage, funnelOrigin);
      return { checked: true, ok: false, code: "FORBIDDEN", status: 403, envVar: translated.envVar, message: translated.message };
    }
    if (response.ok) {
      return {
        checked: true,
        ok: true,
        code: "OK",
        status: response.status,
        envVar: null,
        message: `A origem "${funnelOrigin}" está liberada em ANALYTICS_ALLOWED_ORIGINS.`,
      };
    }
    return {
      checked: true,
      ok: false,
      code: "UNEXPECTED_STATUS",
      status: response.status,
      envVar: null,
      message: `O tracker respondeu ${response.status}, fora do esperado (204 liberado ou 403 bloqueado). Confira se o domínio do tracker está no ar.`,
    };
  } catch (error) {
    if (error instanceof TestarTrackerError) throw error;
    if (error?.name === "AbortError") {
      return {
        checked: true,
        ok: false,
        code: "TIMEOUT",
        status: null,
        envVar: null,
        message: `Sem resposta do tracker em ${config.timeoutMs}ms. Tente de novo — se persistir, o domínio do tracker pode estar fora do ar.`,
      };
    }
    return {
      checked: true,
      ok: false,
      code: "NETWORK_ERROR",
      status: null,
      envVar: null,
      message: "Não consegui falar com o tracker (falha de rede). Confira sua conexão e tente de novo.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Regra do POST /api/sistemas/quiz/testar-tracker, fora do runtime do Next pra ser testável
 * via `node --test`. A rota só faz `requireAdmin()` e delega aqui.
 *
 * Body esperado: { projectId, funnelId, pageId, origin } — os mesmos 4 campos da aba
 * "Instalar tracker". Só `origin` (domínio do FUNIL) dispara um teste real; projectId e
 * funnelId voltam ecoados com `checked:false` — NUNCA um "ok" inventado pra eles.
 */
export async function handleTestarTrackerRequest(payload, options = {}) {
  const body = payload && typeof payload === "object" ? payload : {};
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const funnelId = typeof body.funnelId === "string" ? body.funnelId.trim() : "";
  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  const rawOrigin = typeof body.origin === "string" ? body.origin.trim() : "";

  if (!projectId || !funnelId || !pageId || !rawOrigin) {
    return {
      status: 400,
      body: { error: "Preencha Project ID, Funnel ID, Page ID e o domínio da página antes de testar." },
    };
  }

  const funnelOrigin = normalizeFunnelOrigin(rawOrigin);
  if (!funnelOrigin) {
    return {
      status: 400,
      body: { error: "Domínio da página inválido — use https, sem caminho/query/hash. Ex.: https://roxyfox.online" },
    };
  }

  let originResult;
  try {
    originResult = await checkTrackerOrigin(funnelOrigin, options);
  } catch (error) {
    return {
      status: 503,
      body: {
        error: "Teste indisponível",
        code: error instanceof TestarTrackerError ? error.code : "TESTAR_TRACKER_CONFIG_INVALID",
      },
    };
  }

  return {
    status: 200,
    body: {
      origin: { value: funnelOrigin, ...originResult },
      projectId: {
        value: projectId,
        checked: false,
        envVar: ANALYTICS_ALLOWED_PROJECT_IDS_VAR,
        message: `Não dá pra verificar sem gravar um evento real — o tracker não tem modo de teste. Confirme manualmente que ANALYTICS_ALLOWED_PROJECT_IDS contém "${projectId}" na Vercel.`,
      },
      funnelId: {
        value: funnelId,
        checked: false,
        envVar: ANALYTICS_ALLOWED_FUNNEL_IDS_VAR,
        message: `Não dá pra verificar sem gravar um evento real — o tracker não tem modo de teste. Confirme manualmente que ANALYTICS_ALLOWED_FUNNEL_IDS contém "${funnelId}" na Vercel.`,
      },
    },
  };
}
