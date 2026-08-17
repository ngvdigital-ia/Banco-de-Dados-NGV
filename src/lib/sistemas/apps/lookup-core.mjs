// Finders do lookup de Apps Admin lendo do NGV CORE (edge function apps-lookup-read).
//
// O módulo puro `lookup.mjs` não sabe de onde vem o dado — ele recebe 5 finders injetadas.
// Aqui elas são ligadas a uma fonte real, e a fonte é o Core: `auth.users` do Core resolve
// o e-mail e as tabelas espelho `ngv_apps.*` respondem acesso/compra/produto. O painel NÃO
// abre conexão com o Supabase Apps.
//
// UMA chamada HTTP por lookup, não cinco: a primeira finder dispara o POST, memoiza a
// promessa e as outras quatro leem a fatia correspondente do mesmo corpo.
//
// Config (server-side, ver .env.example):
//   NGV_CORE_APPS_LOOKUP_URL   https://<project>.supabase.co/functions/v1/apps-lookup-read
//   NGV_CORE_BANCO_WRITER_KEY  credencial de ingress exclusiva do Banco (header privado)
//   NGV_CORE_HOST_ALLOWLIST    allowlist de hostnames (fail-closed), a mesma do emitter
//
// Fail-closed no molde de src/lib/ngv-core/emitter.mjs: URL validada contra allowlist de
// host ANTES de qualquer rede, key ausente derruba antes de sair da máquina, AbortController
// próprio com timeout (10s) — falta de timeout já pendurou um cron nesta operação —,
// redirect manual e só 2xx conta como sucesso.
//
// PII: o e-mail sobe no corpo do POST e NÃO volta. Nada aqui é registrado em log — nem o
// e-mail, nem a credencial, nem o corpo da resposta.

import { isAuthorizedBearer } from "../../auth-bearer.mjs";
import { lookupAppsCustomer } from "./lookup.mjs";

export const APPS_LOOKUP_CORE_PATH = "/functions/v1/apps-lookup-read";
export const APPS_LOOKUP_TIMEOUT_MS = 10_000;
export const APPS_LOOKUP_MAX_RESPONSE_BYTES = 256 * 1024;

/**
 * Marcador opaco devolvido por `findUserIdByEmail` quando o Core reconhece o e-mail.
 * O Core NUNCA devolve o uuid de auth.users — `lookupAppsCustomer` só precisa saber se o
 * usuário existe, então devolver o id real seria PII gratuita.
 */
export const CORE_SUBJECT_SENTINEL = "ngv-core-subject";

export class AppsLookupCoreError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "AppsLookupCoreError";
    this.code = code;
  }
}

/** @returns {never} */
function fail(code) {
  throw new AppsLookupCoreError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hosts(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function resolveAppsLookupConfig(options = {}) {
  const requestedTimeout = Number(options.timeoutMs ?? APPS_LOOKUP_TIMEOUT_MS);
  return {
    url: options.url ?? process.env.NGV_CORE_APPS_LOOKUP_URL ?? "",
    writerKey: options.writerKey ?? process.env.NGV_CORE_BANCO_WRITER_KEY ?? "",
    hostAllowlist: options.hostAllowlist ?? process.env.NGV_CORE_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(requestedTimeout)
      ? Math.min(APPS_LOOKUP_TIMEOUT_MS, Math.max(1, requestedTimeout))
      : APPS_LOOKUP_TIMEOUT_MS,
  };
}

export function validateAppsLookupUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw) fail("APPS_LOOKUP_URL_INVALID");
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("APPS_LOOKUP_URL_INVALID");
  }
  if (
    url.protocol !== "https:"
    || (url.port && url.port !== "443")
    || url.username || url.password
    || url.search || url.hash
    || url.pathname !== APPS_LOOKUP_CORE_PATH
  ) fail("APPS_LOOKUP_URL_INVALID");
  if (!hosts(allowlistedHosts).includes(url.hostname.toLowerCase())) fail("APPS_LOOKUP_HOST_NOT_ALLOWLISTED");
  return url;
}

async function readLimited(response, limit = APPS_LOOKUP_MAX_RESPONSE_BYTES) {
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
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof AppsLookupCoreError) throw error;
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

/** Valida o envelope da edge function campo a campo — resposta torta não vira zero silencioso. */
export function parseCoreLookupBody(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("APPS_LOOKUP_RESPONSE_INVALID");
  }
  if (!isPlainObject(parsed)) fail("APPS_LOOKUP_RESPONSE_INVALID");
  if (typeof parsed.resolved !== "boolean") fail("APPS_LOOKUP_RESPONSE_INVALID");
  if (!Array.isArray(parsed.access) || !Array.isArray(parsed.purchases) || !Array.isArray(parsed.products)) {
    fail("APPS_LOOKUP_RESPONSE_INVALID");
  }
  return {
    resolved: parsed.resolved,
    access: parsed.access.filter(isPlainObject),
    purchases: parsed.purchases.filter(isPlainObject),
    products: parsed.products.filter(isPlainObject),
  };
}

async function fetchCoreLookup(email, config, fetchImpl) {
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
  if (typeof config.writerKey !== "string" || !config.writerKey) fail("APPS_LOOKUP_WRITER_KEY_MISSING");
  const url = validateAppsLookupUrl(config.url, config.hostAllowlist);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-ngv-core-key": config.writerKey,
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) fail(`APPS_LOOKUP_REJECTED_${response.status}`);
    return parseCoreLookupBody(await readLimited(response));
  } catch (error) {
    if (error instanceof AppsLookupCoreError) throw error;
    if (error?.name === "AbortError") fail("APPS_LOOKUP_TIMEOUT");
    fail("APPS_LOOKUP_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

// ── Tradução espelho → forma que lookup.mjs projeta ──────────────────────────
//
// O espelho do Core não guarda tudo que a projeção do painel prevê. Onde o dado não
// existe, o campo vai `null` de propósito — nada é inventado:
//   * user_access não tem purchase_platform, purchase_id nem activated_at;
//   * purchase_events não tem nome comercial nem moeda (projectPurchaseRow assume BRL).

function accessInput(row) {
  return {
    offer_slug: row.offer_slug ?? "",
    status: row.status ?? "",
    purchase_platform: null,
    purchase_id: null,
    created_at: row.origin_created_at ?? null,
    activated_at: null,
  };
}

function purchaseInput(row) {
  return {
    product_id: row.product_id ?? null,
    // O espelho guarda a CHAVE do produto, não o nome comercial — é o rótulo legível
    // que existe, e usá-lo evita devolver uma compra sem nenhuma identificação.
    product_name: row.product_key ?? null,
    amount_cents: typeof row.amount_cents === "number" ? row.amount_cents : null,
    event: row.event_type ?? null,
    order_id: row.order_id ?? null,
    catalog_group: row.catalog_group ?? null,
    created_at: row.source_event_at ?? row.received_at ?? null,
  };
}

function grantInput(row) {
  return {
    offer_slug: String(row.offer_slug ?? ""),
    product_key: String(row.product_key ?? ""),
    status: row.status ?? "",
  };
}

/**
 * Catálogo que `computeProductStates` consome. O espelho não tem tabela de produtos, então
 * o catálogo do cliente é o próprio product_grant_state — e o `external_product_id` sai do
 * purchase_events DELE, casando (offer_slug, product_key). Sem esse casamento, todo produto
 * comprado apareceria como "liberado_manual", que é mentira operacional.
 */
export function offerProductInputs(products, purchases) {
  const purchasedByKey = new Map();
  for (const purchase of purchases) {
    if (purchase.product_id == null || String(purchase.product_id) === "") continue;
    purchasedByKey.set(
      `${String(purchase.offer_slug ?? "")}:${String(purchase.product_key ?? "")}`,
      String(purchase.product_id),
    );
  }
  return products.map((row) => {
    const offerSlug = String(row.offer_slug ?? "");
    const productKey = String(row.product_key ?? "");
    return {
      offer_slug: offerSlug,
      product_key: productKey,
      title: String(row.title ?? ""),
      external_product_id: purchasedByKey.get(`${offerSlug}:${productKey}`) ?? null,
    };
  });
}

/**
 * Devolve as 5 finders que `lookupAppsCustomer` espera, todas servidas por UMA chamada
 * HTTP à edge function do Core.
 *
 * `findOfferProducts()` não recebe e-mail (é a assinatura de lookup.mjs) — ela lê o corpo
 * já carregado pela chamada corrente. `lookupAppsCustomer` sempre chama findUserIdByEmail
 * antes, então o corpo existe; se alguém inverter a ordem, estoura em vez de devolver
 * lista vazia silenciosa.
 */
export function criarFindersDoCore(options = {}) {
  const config = resolveAppsLookupConfig(options);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  // Fail-closed antes de qualquer rede: config torta derruba na criação das finders,
  // não no meio do lookup.
  if (typeof config.writerKey !== "string" || !config.writerKey) fail("APPS_LOOKUP_WRITER_KEY_MISSING");
  validateAppsLookupUrl(config.url, config.hostAllowlist);

  let loadedEmail = null;
  let loaded = null;

  function load(email) {
    const key = String(email ?? "");
    if (loaded !== null && loadedEmail === key) return loaded;
    loadedEmail = key;
    loaded = fetchCoreLookup(key, config, fetchImpl);
    return loaded;
  }

  function current() {
    if (loaded === null) fail("APPS_LOOKUP_NOT_STARTED");
    return loaded;
  }

  return {
    async findUserIdByEmail(email) {
      const body = await load(email);
      return body.resolved ? CORE_SUBJECT_SENTINEL : null;
    },
    async findPurchasesByEmail(email) {
      const body = await load(email);
      return body.purchases.map(purchaseInput);
    },
    async findOfferProducts() {
      const body = await current();
      return offerProductInputs(body.products, body.purchases);
    },
    async findActiveProductGrantsByEmail(email) {
      const body = await load(email);
      return body.products.map(grantInput);
    },
    async findUserAccessByUserId() {
      const body = await current();
      return body.access.map(accessInput);
    },
  };
}

/**
 * Regra da rota GET /api/admin/apps/lookup, fora do runtime do Next pra ser testável de
 * verdade pelos DOIS lados (401 sem bearer e 200 com bearer certo) via `node --test`.
 *
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function handleAppsLookupRequest(options = {}) {
  const { authHeader, email, secret, finders, config, fetch: fetchImpl } = options;

  if (!isAuthorizedBearer(authHeader, secret)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  let deps = finders;
  if (!deps) {
    try {
      deps = criarFindersDoCore({ ...config, fetch: fetchImpl });
    } catch (error) {
      // Env ausente/torta = indisponível, não "cliente sem acesso". 503 é o mesmo
      // tratamento que a rota de cron do NGV Core dá pra WRITER_KEY faltando.
      return {
        status: 503,
        body: {
          success: false,
          error: "Lookup indisponível",
          code: error instanceof AppsLookupCoreError ? error.code : "APPS_LOOKUP_CONFIG_INVALID",
        },
      };
    }
  }

  const result = await lookupAppsCustomer({ email, ...deps });

  if (!result.ok) {
    return { status: result.status, body: { success: false, error: result.error, code: result.code } };
  }

  return {
    status: 200,
    body: {
      success: true,
      access: result.access,
      purchases: result.purchases,
      products: result.products,
    },
  };
}
