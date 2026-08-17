// Lógica pura da ação `lookup` do Apps Admin no Banco NGV (Frente B).
//
// Módulo .mjs puro sem dependência de runtime do Next.js nem Supabase importado,
// com injeção de I/O por funções assíncronas — 100% testável via `node --test` sem
// necessidade de credenciais ou rede.
//
// Projeção = ALLOWLIST explícita (segurança e conformidade LGPD):
// - user_access: mantém apenas offer_slug, status, purchase_platform, purchase_id,
//   created_at, activated_at. Ficam de fora: access_token, token_expires_at, token_used_at, user_id.
// - purchases: mantém apenas product_id, product_name, amount_cents, currency, event,
//   order_id, catalog_group, created_at. Ficam de fora: metadados internos e tokens.
// - products: mantém apenas offer_slug, product_key, title, state (comprado | liberado_manual | bloqueado).
//   Ficam de fora: granted_by (PII de equipe), storage_path, granted_at.
// - Não vaza existência de e-mail: e-mail inexistente e e-mail sem compras/acessos
//   produzem a mesma estrutura de arrays vazios com status 200.

export const APPS_LOOKUP_CODES = Object.freeze({
  MISSING_EMAIL: "MISSING_EMAIL",
  INVALID_EMAIL: "INVALID_EMAIL",
  USER_LOOKUP_FAILED: "USER_LOOKUP_FAILED",
  PURCHASES_LOOKUP_FAILED: "PURCHASES_LOOKUP_FAILED",
  PRODUCTS_LOOKUP_FAILED: "PRODUCTS_LOOKUP_FAILED",
  GRANTS_LOOKUP_FAILED: "GRANTS_LOOKUP_FAILED",
  ACCESS_LOOKUP_FAILED: "ACCESS_LOOKUP_FAILED",
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

function toIso(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
}

export function parseEmail(rawEmail) {
  if (rawEmail == null) {
    return {
      ok: false,
      status: 400,
      email: "",
      error: "E-mail inválido",
      code: APPS_LOOKUP_CODES.MISSING_EMAIL,
    };
  }

  if (typeof rawEmail !== "string") {
    return {
      ok: false,
      status: 400,
      email: "",
      error: "E-mail inválido",
      code: APPS_LOOKUP_CODES.INVALID_EMAIL,
    };
  }

  const email = rawEmail.trim();

  if (email === "") {
    return {
      ok: false,
      status: 400,
      email: "",
      error: "E-mail inválido",
      code: APPS_LOOKUP_CODES.MISSING_EMAIL,
    };
  }

  if (
    email.length > MAX_EMAIL_LENGTH ||
    email.includes("..") ||
    !EMAIL_REGEX.test(email)
  ) {
    return {
      ok: false,
      status: 400,
      email: "",
      error: "E-mail inválido",
      code: APPS_LOOKUP_CODES.INVALID_EMAIL,
    };
  }

  return {
    ok: true,
    status: 200,
    email: email.toLowerCase(),
  };
}

export const validateEmail = parseEmail;

export function projectAccessRow(row) {
  if (row == null || typeof row !== "object") return null;

  return {
    offer_slug: String(row.offer_slug ?? ""),
    status: String(row.status ?? ""),
    purchase_platform: row.purchase_platform != null ? String(row.purchase_platform) : null,
    purchase_id: row.purchase_id != null ? String(row.purchase_id) : null,
    created_at: toIso(row.created_at),
    activated_at: toIso(row.activated_at),
  };
}

export function projectPurchaseRow(row) {
  if (row == null || typeof row !== "object") return null;

  return {
    product_id: row.product_id != null ? String(row.product_id) : null,
    product_name: row.product_name != null ? String(row.product_name) : null,
    amount_cents:
      typeof row.amount_cents === "number" && Number.isFinite(row.amount_cents)
        ? row.amount_cents
        : null,
    currency: row.currency != null && String(row.currency).trim() ? String(row.currency).trim() : "BRL",
    event: row.event != null ? String(row.event) : null,
    order_id: row.order_id != null ? String(row.order_id) : null,
    catalog_group: row.catalog_group != null ? String(row.catalog_group) : null,
    created_at: toIso(row.created_at) ?? "",
  };
}

export function computeProductStates({ offerProducts = [], grants = [], purchases = [] } = {}) {
  if (!Array.isArray(offerProducts) || offerProducts.length === 0) {
    return [];
  }

  const activeGrants = Array.isArray(grants) ? grants : [];
  const grantedKeys = new Set(
    activeGrants
      .filter((g) => g && (g.status === "active" || g.status == null))
      .map((g) => `${String(g.offer_slug ?? "")}:${String(g.product_key ?? "")}`)
  );

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const purchasedProductIds = new Set(
    safePurchases
      .map((p) => p?.product_id)
      .filter((id) => id != null && String(id).length > 0)
      .map(String)
  );

  return offerProducts.map((p) => {
    const offerSlug = String(p.offer_slug ?? "");
    const productKey = String(p.product_key ?? "");
    const title = String(p.title ?? "");
    const extProductId =
      p.external_product_id != null && String(p.external_product_id).length > 0
        ? String(p.external_product_id)
        : null;

    const byPurchase = extProductId !== null && purchasedProductIds.has(extProductId);
    const byGrant = grantedKeys.has(`${offerSlug}:${productKey}`);
    const state = byPurchase ? "comprado" : byGrant ? "liberado_manual" : "bloqueado";

    return {
      offer_slug: offerSlug,
      product_key: productKey,
      title,
      state,
    };
  });
}

export async function lookupAppsCustomer(options = {}) {
  const {
    email: rawEmail,
    findUserIdByEmail,
    findPurchasesByEmail,
    findOfferProducts,
    findActiveProductGrantsByEmail,
    findUserAccessByUserId,
  } = options;

  const parsed = parseEmail(rawEmail);
  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      error: parsed.error,
      code: parsed.code,
    };
  }

  const emailLower = parsed.email;

  // 1. Buscar user_id (RPC get_user_id_by_email)
  let userId = null;
  if (typeof findUserIdByEmail === "function") {
    try {
      userId = await findUserIdByEmail(emailLower);
    } catch {
      return {
        ok: false,
        status: 500,
        error: "Falha ao verificar usuário",
        code: APPS_LOOKUP_CODES.USER_LOOKUP_FAILED,
      };
    }
  }

  // 2. Buscar purchases por e-mail
  let purchaseRows = [];
  if (typeof findPurchasesByEmail === "function") {
    try {
      purchaseRows = (await findPurchasesByEmail(emailLower)) ?? [];
    } catch {
      return {
        ok: false,
        status: 500,
        error: "Falha ao consultar compras",
        code: APPS_LOOKUP_CODES.PURCHASES_LOOKUP_FAILED,
      };
    }
  }

  const purchases = Array.isArray(purchaseRows)
    ? purchaseRows.map(projectPurchaseRow).filter(Boolean)
    : [];

  // 3. Buscar catálogo offer_products e grants manuais
  let offerProducts = [];
  if (typeof findOfferProducts === "function") {
    try {
      offerProducts = (await findOfferProducts()) ?? [];
    } catch {
      offerProducts = [];
    }
  }

  let grantRows = [];
  if (Array.isArray(offerProducts) && offerProducts.length > 0 && typeof findActiveProductGrantsByEmail === "function") {
    try {
      grantRows = (await findActiveProductGrantsByEmail(emailLower)) ?? [];
    } catch {
      grantRows = [];
    }
  }

  const products = computeProductStates({
    offerProducts,
    grants: grantRows,
    purchases,
  });

  // 4. Se não existe usuário em auth.users, retorna mesma resposta com access: []
  if (!userId) {
    return {
      ok: true,
      status: 200,
      access: [],
      purchases,
      products,
    };
  }

  // 5. Se existe userId, busca user_access
  let accessRows = [];
  if (typeof findUserAccessByUserId === "function") {
    try {
      accessRows = (await findUserAccessByUserId(userId)) ?? [];
    } catch {
      return {
        ok: false,
        status: 500,
        error: "Falha ao consultar acesso",
        code: APPS_LOOKUP_CODES.ACCESS_LOOKUP_FAILED,
      };
    }
  }

  const access = Array.isArray(accessRows)
    ? accessRows.map(projectAccessRow).filter(Boolean)
    : [];

  return {
    ok: true,
    status: 200,
    access,
    purchases,
    products,
  };
}

export const lookupAppsAccess = lookupAppsCustomer;
