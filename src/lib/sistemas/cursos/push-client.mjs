// Adapter server-to-server pro módulo Cursos dentro do Banco NGV (Fase 4). Sem
// `import "server-only"` aqui de propósito — mesma convenção dos demais adapters .mjs
// de src/lib/sistemas/ (ex.: spy/estado-client.mjs, quiz/analytics-client.mjs): nenhum
// deles importa server-only, pra permanecerem testáveis via `node --test` sem runtime
// React. Quem importa este módulo em produção é sempre um Server Component/Server
// Action já atrás de "server-only" na própria cadeia.
//
// DIFERENÇA DELIBERADA em relação a Spy/Quiz (que só LEEM): este módulo MUTA — dispara
// campanha de push real via OneSignal, através de POST /api/admin/push da Plataforma de
// Cursos. Por decisão explícita do operador nesta fase, a função abaixo EXISTE e é
// TESTÁVEL, mas NENHUM caminho da UI a chama — o botão de envio em
// src/components/sistemas/cursos/push-campaign-form.tsx fica desabilitado e nenhuma
// flag liga o disparo. Ver src/app/(dashboard)/sistemas/cursos/page.tsx
// (SISTEMAS_CURSOS_MODULE_ENABLED) e src/lib/sistemas/cursos/push-dispatch.ts (wiring
// de auditoria pronto, também não chamado por ninguém ainda).
//
// Contrato do endpoint real confirmado em
// /mnt/c/plataforma_de_cursos/app/api/admin/push/route.ts e
// /mnt/c/plataforma_de_cursos/app/admin/push-campaigns/page.tsx nesta sessão — não de
// memória (leitura, nunca escrita, nesse projeto — ele é só fonte). Host de produção
// confirmado em /mnt/c/plataforma_de_cursos/.env.local (NEXT_PUBLIC_SITE_URL) nesta
// sessão: único deploy do projeto "plataforma-de-cursos" (skyvault).

export const CURSOS_PUSH_PATH = "/api/admin/push";

// kiss: resposta do endpoint é um JSON pequeno (id + recipients); 64KB é generoso sem
// ser ilimitado. Revisitar se o endpoint passar a devolver corpo maior.
const MAX_RESPONSE_BYTES = 64 * 1024;
// O route.ts do lado de lá já tem timeout interno de 8s pra chamar o OneSignal; damos
// margem pra essa chamada completar antes de desistirmos do nosso lado.
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 15000;

// Host allowlist HARDCODED — não vem de env, então uma env mal configurada nunca amplia
// o alcance do adapter. Único host de produção da Plataforma de Cursos (skyvault).
const CURSOS_PUSH_ORIGIN = "https://skyvault.ngvmembers.site";

const SEGMENT_PRESETS = Object.freeze(["total", "students", "leads"]);

export class CursosModulePushError extends Error {
  constructor(code) {
    super(code);
    this.name = "CursosModulePushError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new CursosModulePushError(code);
};

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// Mesma regra de "URL-like" do route.ts real (isValidUrlLike): aceita caminho relativo
// começando com "/" OU qualquer URL absoluta com protocolo (inclui deep links tipo
// myapp://...). Não restringe a http/https aqui — o launchUrl e a url dos botões do
// endpoint real aceitam deep link custom de propósito.
function isValidUrlLike(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

// imageUrl é mais restrito no route.ts real (isHttpUrl): só http/https, porque vira
// big_picture/large_icon do OneSignal — não faz sentido aceitar deep link ali.
function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// --- Validação campo a campo do INPUT antes de qualquer chamada de rede ---
// Nenhum campo obrigatório tem fallback silencioso: título/launchUrl ausentes ou com
// tipo errado FALHAM FECHADO com VALIDATE_*, nunca viram string vazia ou valor
// coagido. `message` tem um default documentado e INTENCIONAL pro título (mesmo
// comportamento do route.ts real: `contents: message || title`) — não é a mesma
// classe de bug que "campo obrigatório sumiu virou zero/vazio silencioso".
function validateButton(input, index) {
  if (!isPlainObject(input)) fail("VALIDATE_BUTTON_INVALID");
  const { id, text, url } = input;
  if (!isNonEmptyString(text)) fail("VALIDATE_BUTTON_TEXT_REQUIRED");
  if (url !== undefined && url !== null && url !== "" && !isValidUrlLike(url)) {
    fail("VALIDATE_BUTTON_URL_INVALID");
  }
  const trimmedText = text.trim();
  const trimmedId = isNonEmptyString(id) ? id.trim() : `btn_${index + 1}_${trimmedText.toLowerCase().replace(/\s+/g, "_")}`;
  return { id: trimmedId, text: trimmedText, url: url ? url.trim() : undefined };
}

function validateSegment(input) {
  if (input === undefined || input === null) return "total";
  if (Array.isArray(input)) {
    if (input.length === 0 || !input.every((item) => isNonEmptyString(item))) fail("VALIDATE_SEGMENT_INVALID");
    return input.map((item) => item.trim());
  }
  if (typeof input !== "string") fail("VALIDATE_SEGMENT_INVALID");
  if (!isNonEmptyString(input)) fail("VALIDATE_SEGMENT_INVALID");
  return input.trim();
}

/**
 * Valida e normaliza o input da campanha ANTES de qualquer chamada de rede. Nunca
 * lança silenciosamente pra um valor default em campo obrigatório — lança
 * CursosModulePushError com código VALIDATE_* pra todo campo ausente/malformado.
 * Usada tanto pelo adapter (`sendCursosPushCampaign`) quanto pela tela de composição
 * (validação client-side, mesmo antes do botão de envio existir habilitado).
 */
export function validateCursosPushInput(input) {
  if (!isPlainObject(input)) fail("VALIDATE_INPUT_INVALID");

  const { title, message, imageUrl, launchUrl, buttons, segment, scheduleTime } = input;

  if (typeof title !== "string" || !isNonEmptyString(title)) fail("VALIDATE_TITLE_REQUIRED");
  const trimmedTitle = title.trim();

  if (typeof launchUrl !== "string" || !isNonEmptyString(launchUrl)) fail("VALIDATE_LAUNCH_URL_REQUIRED");
  const trimmedLaunchUrl = launchUrl.trim();
  if (!isValidUrlLike(trimmedLaunchUrl)) fail("VALIDATE_LAUNCH_URL_INVALID");

  let trimmedMessage = trimmedTitle; // default documentado, ver comentário acima
  if (message !== undefined && message !== null && message !== "") {
    if (typeof message !== "string") fail("VALIDATE_MESSAGE_INVALID");
    const trimmed = message.trim();
    if (trimmed.length > 0) trimmedMessage = trimmed;
  }

  let trimmedImageUrl;
  if (imageUrl !== undefined && imageUrl !== null && imageUrl !== "") {
    if (typeof imageUrl !== "string") fail("VALIDATE_IMAGE_URL_INVALID");
    const trimmed = imageUrl.trim();
    if (!isHttpUrl(trimmed)) fail("VALIDATE_IMAGE_URL_INVALID");
    trimmedImageUrl = trimmed;
  }

  let normalizedButtons = [];
  if (buttons !== undefined && buttons !== null) {
    if (!Array.isArray(buttons)) fail("VALIDATE_BUTTON_INVALID");
    normalizedButtons = buttons.map(validateButton);
  }

  const normalizedSegment = validateSegment(segment);

  let trimmedScheduleTime;
  if (scheduleTime !== undefined && scheduleTime !== null && scheduleTime !== "") {
    if (typeof scheduleTime !== "string" || !SCHEDULE_TIME_RE.test(scheduleTime.trim())) {
      fail("VALIDATE_SCHEDULE_TIME_INVALID");
    }
    trimmedScheduleTime = scheduleTime.trim();
  }

  return {
    title: trimmedTitle,
    message: trimmedMessage,
    imageUrl: trimmedImageUrl,
    launchUrl: trimmedLaunchUrl,
    buttons: normalizedButtons,
    segment: normalizedSegment,
    scheduleTime: trimmedScheduleTime,
  };
}

function notConfigured(reason) {
  return { kind: "not_configured", reason, sentAt: null, data: null };
}

function errorResult(code) {
  return { kind: "error", code, sentAt: null, data: null };
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return {
    origin: options.origin ?? CURSOS_PUSH_ORIGIN,
    secret: options.secret ?? process.env.CURSOS_PUSH_ADMIN_SECRET ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, timeout)) : DEFAULT_TIMEOUT_MS,
  };
}

function buildUrl(originStr) {
  let origin;
  try {
    origin = new URL(originStr);
  } catch {
    fail("BASE_URL_INVALID");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password) fail("BASE_URL_INVALID");
  return new URL(CURSOS_PUSH_PATH, origin.origin);
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
    if (error instanceof CursosModulePushError) throw error;
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

async function withTimeout(timeoutMs, run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Resposta de sucesso do route.ts real: { ok: true, id, recipients, details }. Só
// `id` e `recipients` importam pro caller — sem fallback silencioso: `id` ausente ou
// vazio falha fechado (é a única forma de correlacionar essa campanha no OneSignal
// depois).
function parseCursosPushResponsePayload(body) {
  if (!isPlainObject(body)) fail("RESPONSE_SCHEMA_INVALID");
  const { ok, id, recipients } = body;
  if (ok !== true) fail("RESPONSE_SCHEMA_INVALID");
  if (!isNonEmptyString(id)) fail("RESPONSE_SCHEMA_INVALID");
  if (recipients !== null && recipients !== undefined && !isFiniteNumber(recipients)) fail("RESPONSE_SCHEMA_INVALID");
  return { id: id.trim(), recipients: recipients === undefined ? null : recipients };
}

/**
 * Dispara uma campanha de push da Plataforma de Cursos via POST /api/admin/push
 * (que por sua vez chama a API de Notifications do OneSignal). Nunca lança — sempre
 * devolve um resultado tipado:
 *  - { kind: "not_configured", reason }  → CURSOS_PUSH_ADMIN_SECRET ausente neste ambiente
 *  - { kind: "error", code }             → falha em qualquer etapa (prefixos VALIDATE_, SEND_, RESPONSE_, ou BASE_URL_INVALID)
 *  - { kind: "success", sentAt, data }   → campanha aceita pelo OneSignal (id + recipients)
 *
 * IMPORTANTE — Fase 4 (ver topo do arquivo): esta função existe e é testável, mas
 * NENHUM caminho de produto a chama ainda. O disparo real fica desligado até o
 * operador decidir como testar sem notificar aluno de verdade.
 */
export async function sendCursosPushCampaign(input, options = {}) {
  const config = configFrom(options);
  if (!config.secret) {
    return notConfigured("MISSING_CREDENTIALS");
  }

  let payload;
  try {
    payload = validateCursosPushInput(input);
  } catch (error) {
    if (error instanceof CursosModulePushError) return errorResult(error.code);
    throw error;
  }

  try {
    const url = buildUrl(config.origin);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("SEND_FETCH_UNAVAILABLE");

    const response = await withTimeout(config.timeoutMs, (signal) =>
      fetchImpl(url, {
        method: "POST",
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-admin-secret": config.secret,
        },
        body: JSON.stringify({
          title: payload.title,
          message: payload.message,
          imageUrl: payload.imageUrl,
          launchUrl: payload.launchUrl,
          buttons: payload.buttons.length > 0 ? payload.buttons : undefined,
          segment: payload.segment,
          scheduleTime: payload.scheduleTime,
        }),
      }),
    );

    // Códigos com a ETAPA no nome (VALIDATE_* já cobre a etapa local acima; aqui é a
    // etapa de REDE — SEND_*). Distinguível de RESPONSE_* (parsing do corpo) e de
    // BASE_URL_INVALID (config), mesma receita já validada em spy/estado-client.mjs.
    if (isRedirect(response)) return errorResult("SEND_UNEXPECTED_REDIRECT");
    if (response.status === 401 || response.status === 403) return errorResult("SEND_UNAUTHORIZED");
    if (response.status === 429) return errorResult("SEND_RATE_LIMITED");
    if (!response.ok) return errorResult(response.status >= 500 ? "SEND_UPSTREAM_ERROR" : "SEND_REQUEST_INVALID");

    const text = await readBoundedText(response);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      fail("RESPONSE_JSON_INVALID");
    }
    const data = parseCursosPushResponsePayload(body);
    return { kind: "success", sentAt: new Date().toISOString(), data };
  } catch (error) {
    if (error instanceof CursosModulePushError) return errorResult(error.code);
    if (error?.name === "AbortError") return errorResult("SEND_TIMEOUT");
    return errorResult("SEND_NETWORK_ERROR");
  }
}

export const CURSOS_PUSH_SEGMENT_PRESETS = SEGMENT_PRESETS;
