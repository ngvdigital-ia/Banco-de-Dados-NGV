// Adapter server-to-server pro módulo Spy Analytics dentro do Banco NGV (Fase 5, ESCRITA).
// Sem `import "server-only"` aqui de propósito — mesma convenção de spy/estado-client.mjs e dos
// demais adapters .mjs de src/lib/sistemas/: nenhum deles importa server-only, pra permanecerem
// testáveis via `node --test` sem runtime React. Quem importa este módulo em produção é sempre um
// Server Action já atrás de "server-only" na própria cadeia (ver mutations.ts, ao lado).
//
// Mesma receita de login por SESSÃO de estado-client.mjs (cookie HTTP-only assinado HMAC,
// emitido por POST /api/auth) — nunca reusa sessão entre chamadas (kiss: reautentica toda vez,
// mesma decisão do lado leitura). Host allowlist HARDCODED, timeout curto, redirect não seguido,
// payload validado campo a campo nos dois sentidos (entrada ANTES de qualquer chamada de rede,
// resposta ANTES de virar sucesso) — nenhum fallback silencioso (`?? valorPadrao`) em campo
// nenhum: a lição da Fase 2 (Quiz) foi um `input ?? {zeros}` que transformava payload incompleto
// em sucesso com zero, sem nenhum sinal de erro.
//
// Contrato dos 7 endpoints confirmado NESTA SESSÃO em
// workspaces/spy-analytics/api/{ofertas,leituras,config}.js e index.html (linhas 507-516, objeto
// `api`) — não de memória. Nomes de campo no wire são os REAIS: `tipo_produto` (snake_case) pra
// ofertas, `ofertaId` (camelCase, já assim no handler original) pra leituras.
//
// DELETE e o lote de leituras merecem cuidado extra (destroem/sobrescrevem dado real): todo id é
// validado como string não-vazia ANTES de montar a URL — nunca chega a existir um
// `/api/ofertas?id=` ou `/api/leituras?id=` com id vazio/nulo/undefined nesta função.

export const SPY_LOGIN_PATH = "/api/auth";
export const SPY_OFERTAS_PATH = "/api/ofertas";
export const SPY_LEITURAS_PATH = "/api/leituras";
export const SPY_CONFIG_PATH = "/api/config";

// kiss: resposta de mutação é sempre uma linha ou um lote pequeno (nunca o dataset inteiro, ao
// contrário de GET /api/estado) — 512KB é generoso sem ser ilimitado.
const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_TIMEOUT_MS = 8000;
const SESSION_COOKIE_NAME = "spy_session";

// Host allowlist HARDCODED (mesma decisão do lado leitura) — não vem de env, então uma env mal
// configurada nunca amplia o alcance do adapter. Único host de produção do Spy Analytics.
const SPY_ESTADO_ORIGIN = "https://spy-analytics.vercel.app";

// --- Listas fechadas / regex — espelham EXATAMENTE api/ofertas.js e api/leituras.js do original,
// não deduzidas do nome do endpoint. ---
const LINK_HTTP_HTTPS = /^https?:\/\//i;
const CLOAKER_VALIDOS = new Set(["sim", "nao", "talvez"]);
const TIPO_PRODUTO_VALIDOS = new Set(["infoproduto", "nao_identificado"]);
// periodo validado por isPeriodo() abaixo (2 valores fixos) — mesma escolha de estado-client.mjs,
// sem Set pra um par fixo.
const CAMPOS_EDITAVEIS_OFERTA = Object.freeze([
  "nome",
  "formato",
  "nicho",
  "idioma",
  "link",
  "cloaker",
  "tipo_produto",
]);
const CAMPOS_TEXTO_OFERTA = Object.freeze(["nome", "formato", "nicho", "idioma"]);

export class SpyModuleMutationError extends Error {
  constructor(code) {
    super(code);
    this.name = "SpyModuleMutationError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new SpyModuleMutationError(code);
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

// Os dois campos são opcionais: undefined/null/'' = "não preenchido", sempre aceito. Só valor
// fora da lista fechada é rejeitado — mesma regra de api/ofertas.js::valorValido.
function valorValido(valor, validos) {
  if (valor === undefined || valor === null || valor === "") return true;
  return typeof valor === "string" && validos.has(valor);
}

function notConfigured(reason) {
  return { kind: "not_configured", reason, mutatedAt: null, data: null };
}

function errorResult(code) {
  return { kind: "error", code, mutatedAt: null, data: null };
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
    if (error instanceof SpyModuleMutationError) throw error;
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

// --- Núcleo de rede compartilhado pelas 7 operações: login por sessão + 1 chamada de mutação. ---
// Códigos de LOGIN_* nunca levam prefixo de operação (mesma escolha de estado-client.mjs): é o
// MESMO endpoint de login falhando do MESMO jeito não importa qual operação chamou. Códigos da
// ETAPA DE OPERAÇÃO levam o prefixo (`${opPrefix}_UNAUTHORIZED` etc.) — é o que permite
// distinguir "senha errada" (LOGIN_UNAUTHORIZED, corrigir SPY_DASHBOARD_PASSWORD) de "sessão
// recém-emitida foi recusada nesta operação específica" (`${opPrefix}_UNAUTHORIZED`, escala pro
// dono do Spy), regressão do gate held-out já coberta pelos testes de estado-client.mjs.
async function performSpyMutation({ config, fetchImpl, opPrefix, path, method, body }) {
  const loginUrl = buildUrl(config.origin, SPY_LOGIN_PATH);
  const targetUrl = buildUrl(config.origin, path);

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

  if (isRedirect(loginResponse)) fail("LOGIN_UNEXPECTED_REDIRECT");
  if (loginResponse.status === 401 || loginResponse.status === 403) fail("LOGIN_UNAUTHORIZED");
  if (loginResponse.status === 429) fail("LOGIN_RATE_LIMITED");
  if (!loginResponse.ok) fail(loginResponse.status >= 500 ? "LOGIN_UPSTREAM_ERROR" : "LOGIN_REQUEST_INVALID");

  const sessionCookie = extractSessionCookie(loginResponse);
  if (!sessionCookie) fail("LOGIN_COOKIE_MISSING");

  const response = await withTimeout(config.timeoutMs, (signal) =>
    fetchImpl(targetUrl, {
      method,
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: {
        cookie: sessionCookie,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );

  if (isRedirect(response)) fail(`${opPrefix}_UNEXPECTED_REDIRECT`);
  if (response.status === 401 || response.status === 403) fail(`${opPrefix}_UNAUTHORIZED`);
  if (response.status === 429) fail(`${opPrefix}_RATE_LIMITED`);
  if (response.status === 404) fail(`${opPrefix}_NOT_FOUND`);
  if (response.status === 409) fail(`${opPrefix}_CONFLICT`);
  if (!response.ok) fail(response.status >= 500 ? `${opPrefix}_UPSTREAM_ERROR` : `${opPrefix}_REQUEST_INVALID`);

  const text = await readBoundedText(response);
  try {
    return JSON.parse(text);
  } catch {
    fail(`${opPrefix}_RESPONSE_JSON_INVALID`);
  }
}

// --- Validação de ENTRADA campo a campo (falha fechado, ANTES de qualquer chamada de rede). ---

function validateCreateOfertaInput(input) {
  if (!isPlainObject(input)) fail("OFERTA_CREATE_VALIDATION_INVALID");
  const { id, nome, formato, nicho, idioma, link, cloaker, tipo_produto } = input;
  if (!isNonEmptyString(id)) fail("OFERTA_CREATE_VALIDATION_INVALID");
  if (typeof nome !== "string" || nome.trim().length === 0) fail("OFERTA_CREATE_VALIDATION_INVALID");
  for (const value of [formato, nicho, idioma]) {
    if (value !== undefined && value !== null && typeof value !== "string") fail("OFERTA_CREATE_VALIDATION_INVALID");
  }
  if (link !== undefined && link !== null && link !== "") {
    if (typeof link !== "string" || !LINK_HTTP_HTTPS.test(link)) fail("OFERTA_CREATE_VALIDATION_INVALID");
  }
  if (!valorValido(cloaker, CLOAKER_VALIDOS)) fail("OFERTA_CREATE_VALIDATION_INVALID");
  if (!valorValido(tipo_produto, TIPO_PRODUTO_VALIDOS)) fail("OFERTA_CREATE_VALIDATION_INVALID");
  return { id, nome, formato, nicho, idioma, link, cloaker, tipo_produto };
}

// PATCH parcial: só os campos EXPLICITAMENTE presentes no patch (checagem `in`, não `!==
// undefined`) entram no corpo — mesma semântica de api/ofertas.js::editar. Pelo menos 1 campo
// editável precisa estar presente, senão a chamada nem sai (mesma regra de "nenhum campo válido
// para atualizar" do servidor, verificada aqui ANTES de gastar uma chamada de rede).
function validateUpdateOfertaPatch(patch) {
  if (!isPlainObject(patch)) fail("OFERTA_UPDATE_VALIDATION_INVALID");
  const presentes = CAMPOS_EDITAVEIS_OFERTA.filter((campo) => campo in patch);
  if (presentes.length === 0) fail("OFERTA_UPDATE_VALIDATION_INVALID");

  for (const campo of CAMPOS_TEXTO_OFERTA) {
    if (campo in patch) {
      const value = patch[campo];
      if (value !== null && typeof value !== "string") fail("OFERTA_UPDATE_VALIDATION_INVALID");
    }
  }
  if ("link" in patch) {
    const { link } = patch;
    if (link !== null && link !== undefined && link !== "") {
      if (typeof link !== "string" || !LINK_HTTP_HTTPS.test(link)) fail("OFERTA_UPDATE_VALIDATION_INVALID");
    }
  }
  if ("cloaker" in patch && !valorValido(patch.cloaker, CLOAKER_VALIDOS)) fail("OFERTA_UPDATE_VALIDATION_INVALID");
  if ("tipo_produto" in patch && !valorValido(patch.tipo_produto, TIPO_PRODUTO_VALIDOS)) {
    fail("OFERTA_UPDATE_VALIDATION_INVALID");
  }

  const body = {};
  for (const campo of presentes) body[campo] = patch[campo];
  return body;
}

function requireNonEmptyId(id, code) {
  if (!isNonEmptyString(id)) fail(code);
  return id;
}

function validateLeituraItemInput(item) {
  if (!isPlainObject(item)) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  const { id, ofertaId, data, periodo, ads } = item;
  if (!isNonEmptyString(id) || !isNonEmptyString(ofertaId)) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  if (!isDateString(data)) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  if (!isPeriodo(periodo)) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  if (!isNonNegativeInteger(ads)) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  return { id, ofertaId, data, periodo, ads };
}

// Lote vazio falha fechado ANTES de qualquer rede — é exatamente o caso que o handoff pede pra
// cobrir explicitamente (nunca um POST com itens: [] silencioso).
function validateLeiturasBatchInput(itens) {
  if (!Array.isArray(itens) || itens.length === 0) fail("LEITURAS_BATCH_VALIDATION_INVALID");
  return itens.map(validateLeituraItemInput);
}

function validateAdsInput(ads, code) {
  if (!isNonNegativeInteger(ads)) fail(code);
  return ads;
}

function validateConfigInput(pesos, tolerancia) {
  if (!isPlainObject(pesos)) fail("CONFIG_UPDATE_VALIDATION_INVALID");
  const { estab, vol, tempo } = pesos;
  if (![estab, vol, tempo].every(isFiniteNumber)) fail("CONFIG_UPDATE_VALIDATION_INVALID");
  // NOTA: tolerância aqui é Number.isFinite, NÃO inteiro não-negativo — diferente da leitura em
  // GET /api/estado (estado-client.mjs valida inteiro >= 0). Mirrorado exatamente do contrato
  // real de api/config.js::validar, não deduzido: as duas rotas do Spy divergem nessa regra.
  if (!isFiniteNumber(tolerancia)) fail("CONFIG_UPDATE_VALIDATION_INVALID");
  return { pesos: { estab, vol, tempo }, tolerancia };
}

// --- Validação de SAÍDA campo a campo (falha fechado, ANTES de virar sucesso). ---

function validateOfertaRow(input, opPrefix) {
  const code = `${opPrefix}_RESPONSE_SCHEMA_INVALID`;
  if (!isPlainObject(input)) fail(code);
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
    fail(code);
  }
  return { id, nome, formato, nicho, idioma, link, cloaker, tipoProduto: tipo_produto };
}

function validateOkRow(input, opPrefix) {
  const code = `${opPrefix}_RESPONSE_SCHEMA_INVALID`;
  if (!isPlainObject(input) || input.ok !== true) fail(code);
  return { ok: true };
}

function validateLeituraRow(input, opPrefix) {
  const code = `${opPrefix}_RESPONSE_SCHEMA_INVALID`;
  if (!isPlainObject(input)) fail(code);
  const { id, ofertaId, data, periodo, ads } = input;
  if (!isNonEmptyString(id) || !isNonEmptyString(ofertaId) || !isDateString(data) || !isPeriodo(periodo) || !isNonNegativeInteger(ads)) {
    fail(code);
  }
  return { id, ofertaId, data, periodo, ads };
}

function validateLeiturasBatchRow(input, opPrefix) {
  const code = `${opPrefix}_RESPONSE_SCHEMA_INVALID`;
  if (!isPlainObject(input) || !Array.isArray(input.leituras)) fail(code);
  return { leituras: input.leituras.map((item) => validateLeituraRow(item, opPrefix)) };
}

function validateConfigRow(input, opPrefix) {
  const code = `${opPrefix}_RESPONSE_SCHEMA_INVALID`;
  if (!isPlainObject(input)) fail(code);
  const { pesos, tolerancia } = input;
  if (!isPlainObject(pesos)) fail(code);
  const { estab, vol, tempo } = pesos;
  if (![estab, vol, tempo].every(isFiniteNumber)) fail(code);
  if (!isFiniteNumber(tolerancia)) fail(code);
  return { pesos: { estab, vol, tempo }, tolerancia };
}

function queryPath(basePath, id) {
  return `${basePath}?id=${encodeURIComponent(id)}`;
}

async function runMutation(options, opPrefix, buildRequest) {
  const config = configFrom(options);
  if (!config.password) return notConfigured("MISSING_CREDENTIALS");
  try {
    const { path, method, body, parseSuccess } = buildRequest(config);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
    const rawBody = await performSpyMutation({ config, fetchImpl, opPrefix, path, method, body });
    const data = parseSuccess(rawBody);
    return { kind: "success", mutatedAt: new Date().toISOString(), data };
  } catch (error) {
    if (error instanceof SpyModuleMutationError) return errorResult(error.code);
    if (error?.name === "AbortError") return errorResult("TIMEOUT");
    return errorResult("NETWORK_ERROR");
  }
}

/** POST /api/ofertas — cria uma oferta. Nunca lança; devolve resultado tipado. */
export async function createSpyOferta(input, options = {}) {
  return runMutation(options, "OFERTA_CREATE", () => ({
    path: SPY_OFERTAS_PATH,
    method: "POST",
    body: validateCreateOfertaInput(input),
    parseSuccess: (raw) => validateOfertaRow(raw, "OFERTA_CREATE"),
  }));
}

/** PATCH /api/ofertas?id=<id> — edita campos de uma oferta (parcial). Nunca lança. */
export async function updateSpyOferta(id, patch, options = {}) {
  return runMutation(options, "OFERTA_UPDATE", () => ({
    path: queryPath(SPY_OFERTAS_PATH, requireNonEmptyId(id, "OFERTA_UPDATE_VALIDATION_INVALID")),
    method: "PATCH",
    body: validateUpdateOfertaPatch(patch),
    parseSuccess: (raw) => validateOfertaRow(raw, "OFERTA_UPDATE"),
  }));
}

/** DELETE /api/ofertas?id=<id> — remove uma oferta (cascata apaga leituras do lado do Spy). */
export async function deleteSpyOferta(id, options = {}) {
  return runMutation(options, "OFERTA_DELETE", () => ({
    path: queryPath(SPY_OFERTAS_PATH, requireNonEmptyId(id, "OFERTA_DELETE_VALIDATION_INVALID")),
    method: "DELETE",
    body: undefined,
    parseSuccess: (raw) => validateOkRow(raw, "OFERTA_DELETE"),
  }));
}

/** POST /api/leituras — grava um LOTE de leituras (upsert por oferta+data+período). */
export async function saveSpyLeiturasBatch(itens, options = {}) {
  return runMutation(options, "LEITURAS_BATCH", () => ({
    path: SPY_LEITURAS_PATH,
    method: "POST",
    body: { itens: validateLeiturasBatchInput(itens) },
    parseSuccess: (raw) => validateLeiturasBatchRow(raw, "LEITURAS_BATCH"),
  }));
}

/** PATCH /api/leituras?id=<id> — corrige o valor de `ads` de uma leitura. */
export async function updateSpyLeitura(id, ads, options = {}) {
  return runMutation(options, "LEITURA_UPDATE", () => ({
    path: queryPath(SPY_LEITURAS_PATH, requireNonEmptyId(id, "LEITURA_UPDATE_VALIDATION_INVALID")),
    method: "PATCH",
    body: { ads: validateAdsInput(ads, "LEITURA_UPDATE_VALIDATION_INVALID") },
    parseSuccess: (raw) => validateLeituraRow(raw, "LEITURA_UPDATE"),
  }));
}

/** DELETE /api/leituras?id=<id> — remove uma leitura. */
export async function deleteSpyLeitura(id, options = {}) {
  return runMutation(options, "LEITURA_DELETE", () => ({
    path: queryPath(SPY_LEITURAS_PATH, requireNonEmptyId(id, "LEITURA_DELETE_VALIDATION_INVALID")),
    method: "DELETE",
    body: undefined,
    parseSuccess: (raw) => validateOkRow(raw, "LEITURA_DELETE"),
  }));
}

/** PUT /api/config — grava pesos (estab/vol/tempo) + tolerância do critério (singleton id=1). */
export async function updateSpyConfig(pesos, tolerancia, options = {}) {
  return runMutation(options, "CONFIG_UPDATE", () => {
    const payload = validateConfigInput(pesos, tolerancia);
    return {
      path: SPY_CONFIG_PATH,
      method: "PUT",
      body: payload,
      parseSuccess: (raw) => validateConfigRow(raw, "CONFIG_UPDATE"),
    };
  });
}
