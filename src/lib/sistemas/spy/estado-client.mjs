// Adapter server-to-server pro módulo Spy Analytics dentro do Banco NGV (Fase 3, somente
// leitura). Sem `import "server-only"` aqui de propósito — mesma convenção dos demais adapters
// .mjs de src/lib/sistemas/ e src/lib/operacao/ (ex.: quiz/analytics-client.mjs): nenhum deles
// importa server-only, pra permanecerem testáveis via `node --test` sem runtime React. Quem
// importa este módulo é sempre um Server Component/Server Action já atrás de "server-only" na
// própria cadeia (ex.: src/lib/sistemas/authz.ts).
//
// ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 4 — mesma receita já validada em
// src/lib/sistemas/quiz/analytics-client.mjs (host allowlist hardcoded, secret não-NEXT_PUBLIC,
// timeout curto, redirect não seguido, resposta validada campo a campo, estados discriminados
// not_configured/error/success com data:null nos dois primeiros).
//
// DIFERENÇA DELIBERADA em relação ao Quiz: o Quiz autentica com Basic Auth stateless (1
// requisição). O Spy autentica por SESSÃO — cookie HTTP-only assinado HMAC (spy_session), emitido
// por POST /api/estado/../auth a partir de uma senha compartilhada do time (workspaces/spy-analytics/
// api/_auth.js). Não há como mintar esse cookie aqui: a chave de assinatura (SESSION_SECRET) só
// existe no ambiente do Spy. Então este adapter faz o MESMO fluxo que o navegador do time faz —
// POST /api/auth com a senha, guarda só o Set-Cookie da resposta — e usa esse cookie na sequência
// pra GET /api/estado. Nunca reusa sessão entre chamadas (kiss: reautentica toda vez; ver
// fetchSpyModuleEstado) — sem cache de cookie compartilhado entre requisições/usuários.
//
// Contrato do endpoint real confirmado em workspaces/ofertas-ngv/spy-analytics/api/estado.js e
// api/_auth.js nesta sessão — não de memória. Host de produção confirmado via `vercel project ls`
// (escopo ngvdigitas-projects) em 2026-08-16: único deploy do projeto "spy-analytics".

export const SPY_LOGIN_PATH = "/api/auth";
export const SPY_ESTADO_PATH = "/api/estado";

// kiss: ofertas+leituras crescem com o tempo (sem paginação no Spy hoje — ver comentário em
// migrations/002 do Spy). 2MB cobre um volume generoso sem ficar ilimitado; revisitar se o Spy
// passar a paginar ou o payload real aproximar do teto.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_TIMEOUT_MS = 8000;
const SESSION_COOKIE_NAME = "spy_session";

// Host allowlist HARDCODED (ADR Decisão 4) — não vem de env, então uma env mal configurada nunca
// amplia o alcance do adapter. Único host de produção do Spy Analytics.
const SPY_ESTADO_ORIGIN = "https://spy-analytics.vercel.app";

export class SpyModuleEstadoError extends Error {
  constructor(code) {
    super(code);
    this.name = "SpyModuleEstadoError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new SpyModuleEstadoError(code);
};

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPeriodo(value) {
  return value === "manha" || value === "noite";
}

function notConfigured(reason) {
  return { kind: "not_configured", reason, fetchedAt: null, data: null };
}

function errorResult(code) {
  return { kind: "error", code, fetchedAt: null, data: null };
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return {
    origin: options.origin ?? SPY_ESTADO_ORIGIN,
    password: options.password ?? process.env.SPY_DASHBOARD_PASSWORD ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, timeout)) : DEFAULT_TIMEOUT_MS,
  };
}

function buildUrl(originStr, path) {
  let origin;
  try {
    origin = new URL(originStr);
  } catch {
    fail("BASE_URL_INVALID");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password) fail("BASE_URL_INVALID");
  return new URL(path, origin.origin);
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
    if (error instanceof SpyModuleEstadoError) throw error;
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

function isRedirect(response) {
  return response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
}

// Extrai só o par "spy_session=<valor>" do Set-Cookie da resposta de login — nunca repassa
// atributos (HttpOnly/Secure/SameSite/Max-Age), só o necessário pro próximo request. Usa
// getSetCookie() quando disponível (undici/Node 18+; expõe múltiplos Set-Cookie corretamente);
// cai pra .get("set-cookie") em runtimes sem esse método.
function extractSessionCookie(response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const entry of raw) {
    const pair = entry.split(";")[0]?.trim();
    if (pair && pair.startsWith(`${SESSION_COOKIE_NAME}=`)) return pair;
  }
  return null;
}

async function withTimeout(timeoutMs, run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// --- Validação campo a campo do payload de GET /api/estado (nunca JSON.parse cego) ---
// Nenhum campo abaixo tem fallback silencioso (`?? valorPadrao`) — a lição da Fase 2 (Quiz):
// um `input ?? { zeros }` num campo transformava payload incompleto em sucesso com zero, sem
// nenhum sinal de erro. Aqui, ausência/tipo errado em QUALQUER campo — incluindo pesos,
// tolerancia e prontasParaModelar — falha fechado com RESPONSE_SCHEMA_INVALID. Ver testes de
// regressão no arquivo de teste deste módulo.

function validateOferta(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { id, nome, formato, nicho, idioma, link, cloaker, tipo_produto } = input;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(nome) ||
    !isNullableString(formato) ||
    !isNullableString(nicho) ||
    !isNullableString(idioma) ||
    !isNullableString(link) ||
    !isNullableString(cloaker) ||
    !isNullableString(tipo_produto)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return { id, nome, formato, nicho, idioma, link, cloaker, tipoProduto: tipo_produto };
}

function validateLeitura(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { id, ofertaId, data, periodo, ads } = input;
  if (
    !isNonEmptyString(id) ||
    !isNonEmptyString(ofertaId) ||
    !isDateString(data) ||
    !isPeriodo(periodo) ||
    !isNonNegativeInteger(ads)
  ) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  return { id, ofertaId, data, periodo, ads };
}

function validatePesos(input) {
  if (!isPlainObject(input)) fail("RESPONSE_SCHEMA_INVALID");
  const { estab, vol, tempo } = input;
  if (![estab, vol, tempo].every(isFiniteNumber)) fail("RESPONSE_SCHEMA_INVALID");
  return { estab, vol, tempo };
}

function validateProntaId(input) {
  if (!isNonEmptyString(input)) fail("RESPONSE_SCHEMA_INVALID");
  return input;
}

export function parseSpyModuleEstadoPayload(body) {
  if (!isPlainObject(body)) fail("RESPONSE_SCHEMA_INVALID");
  const { ofertas, leituras, pesos, tolerancia, prontasParaModelar } = body;
  if (!Array.isArray(ofertas) || !Array.isArray(leituras) || !Array.isArray(prontasParaModelar)) {
    fail("RESPONSE_SCHEMA_INVALID");
  }
  if (!isNonNegativeInteger(tolerancia)) fail("RESPONSE_SCHEMA_INVALID");
  return {
    ofertas: ofertas.map(validateOferta),
    leituras: leituras.map(validateLeitura),
    pesos: validatePesos(pesos),
    tolerancia,
    prontasParaModelar: prontasParaModelar.map(validateProntaId),
  };
}

/**
 * Busca o estado completo do Spy (ofertas, leituras, pesos/tolerância de critério, e a lista de
 * ofertas prontas pra modelar) via login por sessão + GET /api/estado. Nunca lança — sempre
 * devolve um resultado tipado:
 *  - { kind: "not_configured", reason }  → credencial ausente neste ambiente
 *  - { kind: "error", code }             → falha (401/timeout/schema/etc), erro visível
 *  - { kind: "success", fetchedAt, data } → payload validado campo a campo
 *
 * `fetchedAt` é o instante em que ESTE adapter leu o Spy (o Spy não devolve timestamp de geração
 * em /api/estado — é leitura do estado atual, não um snapshot pré-agregado). Componentes devem
 * rotular isso como "Consultado em", nunca "Gerado em".
 */
export async function fetchSpyModuleEstado(options = {}) {
  const config = configFrom(options);
  if (!config.password) {
    return notConfigured("MISSING_CREDENTIALS");
  }

  try {
    const loginUrl = buildUrl(config.origin, SPY_LOGIN_PATH);
    const estadoUrl = buildUrl(config.origin, SPY_ESTADO_PATH);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");

    // Passo 1 — login server-to-server com a senha compartilhada do time (mesmo POST /api/auth
    // que o navegador faz), pra obter o cookie de sessão assinado.
    const loginResponse = await withTimeout(config.timeoutMs, (signal) =>
      fetchImpl(loginUrl, {
        method: "POST",
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ senha: config.password }),
      }),
    );

    // Códigos com a ETAPA no nome. O gate held-out provou que usar o mesmo
    // "UNAUTHORIZED" nas duas etapas torna indistinguível, em produção, "a senha
    // está errada" (corrigir SPY_DASHBOARD_PASSWORD aqui) de "o Spy rejeitou uma
    // sessão que ele mesmo acabou de emitir" (divergência de SESSION_SECRET, que é
    // problema do lado do Spy). São diagnósticos e donos diferentes.
    if (isRedirect(loginResponse)) return errorResult("LOGIN_UNEXPECTED_REDIRECT");
    if (loginResponse.status === 401 || loginResponse.status === 403) return errorResult("LOGIN_UNAUTHORIZED");
    if (loginResponse.status === 429) return errorResult("LOGIN_RATE_LIMITED");
    if (!loginResponse.ok) return errorResult(loginResponse.status >= 500 ? "LOGIN_UPSTREAM_ERROR" : "LOGIN_REQUEST_INVALID");

    const sessionCookie = extractSessionCookie(loginResponse);
    if (!sessionCookie) return errorResult("LOGIN_COOKIE_MISSING");

    // Passo 2 — GET /api/estado com a sessão recém-emitida.
    const estadoResponse = await withTimeout(config.timeoutMs, (signal) =>
      fetchImpl(estadoUrl, {
        method: "GET",
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { cookie: sessionCookie, accept: "application/json" },
      }),
    );

    // Etapa ESTADO — ver nota na etapa de login sobre por que o código carrega a etapa.
    // ESTADO_UNAUTHORIZED aqui significa: o login funcionou, o cookie foi emitido, e
    // ainda assim o Spy recusou. Isso NÃO é senha errada — é sinal de problema do lado
    // do Spy, e escala para o dono dele, não para quem configurou o Banco NGV.
    if (isRedirect(estadoResponse)) return errorResult("ESTADO_UNEXPECTED_REDIRECT");
    if (estadoResponse.status === 401 || estadoResponse.status === 403) return errorResult("ESTADO_UNAUTHORIZED");
    if (!estadoResponse.ok) return errorResult(estadoResponse.status >= 500 ? "ESTADO_UPSTREAM_ERROR" : "ESTADO_REQUEST_INVALID");

    const text = await readBoundedText(estadoResponse);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      fail("RESPONSE_JSON_INVALID");
    }
    const data = parseSpyModuleEstadoPayload(body);
    return { kind: "success", fetchedAt: new Date().toISOString(), data };
  } catch (error) {
    if (error instanceof SpyModuleEstadoError) return errorResult(error.code);
    if (error?.name === "AbortError") return errorResult("TIMEOUT");
    return errorResult("NETWORK_ERROR");
  }
}
