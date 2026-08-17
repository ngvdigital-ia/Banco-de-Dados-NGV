import assert from "node:assert/strict";
import test from "node:test";
import {
  APPS_LOOKUP_CODES,
  computeProductStates,
  lookupAppsAccess,
  lookupAppsCustomer,
  parseEmail,
  projectAccessRow,
  projectPurchaseRow,
  validateEmail,
} from "../src/lib/sistemas/apps/lookup.mjs";

// ── 1. Validação e normalização de e-mail ─────────────────────────────────────

test("parseEmail: entrada vazia ou nula retorna erro 400 com MISSING_EMAIL", () => {
  const cases = ["", "   ", "\t\n", null, undefined];
  for (const c of cases) {
    const res = parseEmail(c);
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.equal(res.code, APPS_LOOKUP_CODES.MISSING_EMAIL);
    assert.equal(res.error, "E-mail inválido");
  }
});

test("parseEmail: e-mail inválido retorna erro 400 com INVALID_EMAIL", () => {
  const cases = [
    "notanemail",
    "@missinguser.com",
    "missingdomain@",
    "missingdot@domain",
    "spaces in @ email.com",
    "email@domain..com",
    12345,
    { email: "user@example.com" },
    "a".repeat(320) + "@domain.com", // excede tamanho máximo
  ];
  for (const c of cases) {
    const res = parseEmail(c);
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.equal(res.code, APPS_LOOKUP_CODES.INVALID_EMAIL);
    assert.equal(res.error, "E-mail inválido");
  }
});

test("parseEmail e validateEmail: e-mail válido é normalizado para minúsculas", () => {
  const valid = [
    { input: "User@Example.COM", expected: "user@example.com" },
    { input: "  comprador.vip+tag@ngvdigital.com.br  ", expected: "comprador.vip+tag@ngvdigital.com.br" },
    { input: "cliente_123@sub.dominio.co", expected: "cliente_123@sub.dominio.co" },
  ];
  for (const { input, expected } of valid) {
    const res1 = parseEmail(input);
    assert.equal(res1.ok, true);
    assert.equal(res1.status, 200);
    assert.equal(res1.email, expected);

    const res2 = validateEmail(input);
    assert.equal(res2.ok, true);
    assert.equal(res2.email, expected);
  }
});

// ── 2. Projeção de AccessRow (Allowlist estrita e anti-vazamento de tokens) ───

test("projectAccessRow: projeta apenas os campos permitidos da allowlist", () => {
  const raw = {
    offer_slug: "metodo-alpha",
    status: "active",
    purchase_platform: "kiwify",
    purchase_id: "order_12345",
    created_at: "2026-05-10T12:00:00.000Z",
    activated_at: "2026-05-10T12:05:00.000Z",
  };

  const projected = projectAccessRow(raw);
  assert.deepEqual(projected, {
    offer_slug: "metodo-alpha",
    status: "active",
    purchase_platform: "kiwify",
    purchase_id: "order_12345",
    created_at: "2026-05-10T12:00:00.000Z",
    activated_at: "2026-05-10T12:05:00.000Z",
  });
});

test("projectAccessRow: NUNCA vaza access_token, user_id, nem metadados internos", () => {
  const rawWithSecrets = {
    offer_slug: "metodo-beta",
    status: "active",
    purchase_platform: "hotmart",
    purchase_id: "pur_999",
    created_at: new Date("2026-06-01T10:00:00.000Z"),
    activated_at: null,
    // Campos sensíveis proibidos:
    access_token: "jwt-magic-token-secret-xyz-123",
    token_expires_at: "2026-12-31T23:59:59.000Z",
    token_used_at: "2026-06-01T10:05:00.000Z",
    user_id: "auth-uuid-privado-8888",
    internal_admin_note: "cliente reclamou no reclame aqui",
  };

  const projected = projectAccessRow(rawWithSecrets);
  assert.equal(projected.access_token, undefined);
  assert.equal(projected.token_expires_at, undefined);
  assert.equal(projected.token_used_at, undefined);
  assert.equal(projected.user_id, undefined);
  assert.equal(projected.internal_admin_note, undefined);

  const keys = Object.keys(projected);
  assert.deepEqual(keys.sort(), [
    "activated_at",
    "created_at",
    "offer_slug",
    "purchase_id",
    "purchase_platform",
    "status",
  ]);

  const jsonStr = JSON.stringify(projected);
  assert.equal(jsonStr.includes("jwt-magic-token"), false);
  assert.equal(jsonStr.includes("auth-uuid-privado"), false);
});

test("projectAccessRow: entrada nula ou inválida retorna null", () => {
  assert.equal(projectAccessRow(null), null);
  assert.equal(projectAccessRow(undefined), null);
  assert.equal(projectAccessRow("not-an-object"), null);
});

// ── 3. Projeção de PurchaseRow (Allowlist estrita e anti-vazamento de dados) ──

test("projectPurchaseRow: projeta apenas os campos de compra permitidos", () => {
  const raw = {
    product_id: "prod_front_01",
    product_name: "Guia Principal",
    amount_cents: 9700,
    currency: "BRL",
    event: "approved",
    order_id: "ord_abc123",
    catalog_group: "saude",
    created_at: "2026-07-01T14:30:00.000Z",
  };

  const projected = projectPurchaseRow(raw);
  assert.deepEqual(projected, {
    product_id: "prod_front_01",
    product_name: "Guia Principal",
    amount_cents: 9700,
    currency: "BRL",
    event: "approved",
    order_id: "ord_abc123",
    catalog_group: "saude",
    created_at: "2026-07-01T14:30:00.000Z",
  });
});

test("projectPurchaseRow: NUNCA vaza cartão, CPF, telefone nem webhook raw", () => {
  const rawWithPii = {
    product_id: "prod_02",
    product_name: "Order Bump",
    amount_cents: 2900,
    currency: "BRL",
    event: "approved",
    order_id: "ord_999",
    catalog_group: null,
    created_at: "2026-07-01T14:30:00.000Z",
    // PII / dados de pagamento:
    email: "cliente@privado.com",
    customer_cpf: "123.456.789-00",
    customer_phone: "+5511999998888",
    card_last_four: "4242",
    gateway_raw_payload: { card_token: "tok_secret" },
  };

  const projected = projectPurchaseRow(rawWithPii);
  assert.equal(projected.email, undefined);
  assert.equal(projected.customer_cpf, undefined);
  assert.equal(projected.customer_phone, undefined);
  assert.equal(projected.card_last_four, undefined);
  assert.equal(projected.gateway_raw_payload, undefined);

  const keys = Object.keys(projected);
  assert.deepEqual(keys.sort(), [
    "amount_cents",
    "catalog_group",
    "created_at",
    "currency",
    "event",
    "order_id",
    "product_id",
    "product_name",
  ]);

  const jsonStr = JSON.stringify(projected);
  assert.equal(jsonStr.includes("123.456.789-00"), false);
  assert.equal(jsonStr.includes("tok_secret"), false);
});

// ── 4. computeProductStates (Gate híbrido: compras vs grants manuais) ─────────

test("computeProductStates: calcula comprado, liberado_manual e bloqueado", () => {
  const offerProducts = [
    {
      offer_slug: "oferta-1",
      product_key: "ebook-principal",
      title: "Ebook Principal",
      external_product_id: "ext_prod_100",
      storage_path: "oferta-1/ebook.pdf",
    },
    {
      offer_slug: "oferta-1",
      product_key: "audio-bonus",
      title: "Áudio Bônus",
      external_product_id: "ext_prod_200",
    },
    {
      offer_slug: "oferta-1",
      product_key: "planilha-vip",
      title: "Planilha VIP",
      external_product_id: null,
    },
    {
      offer_slug: "oferta-2",
      product_key: "curso-extra",
      title: "Curso Extra",
      external_product_id: "ext_prod_300",
    },
  ];

  const purchases = [
    { product_id: "ext_prod_100" }, // comprou ebook-principal
  ];

  const grants = [
    {
      offer_slug: "oferta-1",
      product_key: "audio-bonus",
      status: "active",
      granted_by: "admin@ngv.digital", // PII de equipe
    },
    {
      offer_slug: "oferta-2",
      product_key: "curso-extra",
      status: "revoked", // revogado -> deve ficar bloqueado
      granted_by: "admin@ngv.digital",
    },
  ];

  const result = computeProductStates({ offerProducts, grants, purchases });

  assert.equal(result.length, 4);

  // 1. ebook-principal: comprado via external_product_id
  assert.deepEqual(result[0], {
    offer_slug: "oferta-1",
    product_key: "ebook-principal",
    title: "Ebook Principal",
    state: "comprado",
  });

  // 2. audio-bonus: liberado_manual via user_product_grants ativo
  assert.deepEqual(result[1], {
    offer_slug: "oferta-1",
    product_key: "audio-bonus",
    title: "Áudio Bônus",
    state: "liberado_manual",
  });

  // 3. planilha-vip: sem compra nem grant -> bloqueado
  assert.deepEqual(result[2], {
    offer_slug: "oferta-1",
    product_key: "planilha-vip",
    title: "Planilha VIP",
    state: "bloqueado",
  });

  // 4. curso-extra: grant está revogado e não comprou -> bloqueado
  assert.deepEqual(result[3], {
    offer_slug: "oferta-2",
    product_key: "curso-extra",
    title: "Curso Extra",
    state: "bloqueado",
  });

  // NUNCA vaza granted_by (PII de equipe) nem storage_path
  for (const item of result) {
    assert.equal(item.granted_by, undefined);
    assert.equal(item.storage_path, undefined);
    assert.deepEqual(Object.keys(item).sort(), ["offer_slug", "product_key", "state", "title"]);
  }
});

test("computeProductStates: compra tem precedência sobre grant manual", () => {
  const offerProducts = [
    {
      offer_slug: "oferta-1",
      product_key: "p1",
      title: "Produto 1",
      external_product_id: "ext_1",
    },
  ];
  const purchases = [{ product_id: "ext_1" }];
  const grants = [{ offer_slug: "oferta-1", product_key: "p1", status: "active" }];

  const result = computeProductStates({ offerProducts, grants, purchases });
  assert.equal(result[0].state, "comprado");
});

test("computeProductStates: catálogo vazio retorna array vazio", () => {
  assert.deepEqual(computeProductStates({ offerProducts: [] }), []);
  assert.deepEqual(computeProductStates(), []);
});

// ── 5. lookupAppsCustomer: Fluxos completos e Injeção de I/O ─────────────────

test("lookupAppsCustomer: e-mail inválido ou vazio rejeita 400 sem tocar nas funções de I/O", async () => {
  const boom = () => {
    throw new Error("I/O não deveria ser chamado para e-mail inválido");
  };

  const resEmpty = await lookupAppsCustomer({
    email: "",
    findUserIdByEmail: boom,
    findPurchasesByEmail: boom,
    findOfferProducts: boom,
    findActiveProductGrantsByEmail: boom,
    findUserAccessByUserId: boom,
  });
  assert.equal(resEmpty.ok, false);
  assert.equal(resEmpty.status, 400);
  assert.equal(resEmpty.code, APPS_LOOKUP_CODES.MISSING_EMAIL);

  const resInvalid = await lookupAppsCustomer({
    email: "not-an-email",
    findUserIdByEmail: boom,
    findPurchasesByEmail: boom,
    findOfferProducts: boom,
  });
  assert.equal(resInvalid.ok, false);
  assert.equal(resInvalid.status, 400);
  assert.equal(resInvalid.code, APPS_LOOKUP_CODES.INVALID_EMAIL);
});

test("lookupAppsCustomer: e-mail achado com dados completos retorna 200 com projeções estritas", async () => {
  const calls = {
    findUserIdByEmail: [],
    findPurchasesByEmail: [],
    findOfferProducts: 0,
    findActiveProductGrantsByEmail: [],
    findUserAccessByUserId: [],
  };

  const result = await lookupAppsCustomer({
    email: "Comprador@Dominio.COM",
    findUserIdByEmail: async (emailLower) => {
      calls.findUserIdByEmail.push(emailLower);
      return "user_uuid_12345";
    },
    findPurchasesByEmail: async (emailLower) => {
      calls.findPurchasesByEmail.push(emailLower);
      return [
        {
          product_id: "ext_10",
          product_name: "Oferta Principal",
          amount_cents: 19700,
          currency: "BRL",
          event: "approved",
          order_id: "ord_1",
          catalog_group: "saude",
          created_at: "2026-08-01T10:00:00.000Z",
          email: "comprador@dominio.com", // PII que deve ser filtrada
        },
      ];
    },
    findOfferProducts: async () => {
      calls.findOfferProducts++;
      return [
        {
          offer_slug: "saude-vsl",
          product_key: "manual-pdf",
          title: "Manual PDF",
          external_product_id: "ext_10",
          storage_path: "/private/manual.pdf",
        },
        {
          offer_slug: "saude-vsl",
          product_key: "protocolo-sono",
          title: "Protocolo do Sono",
          external_product_id: "ext_20",
        },
      ];
    },
    findActiveProductGrantsByEmail: async (emailLower) => {
      calls.findActiveProductGrantsByEmail.push(emailLower);
      return [
        {
          offer_slug: "saude-vsl",
          product_key: "protocolo-sono",
          status: "active",
          granted_by: "suporte@empresa.com", // PII de equipe
        },
      ];
    },
    findUserAccessByUserId: async (userId) => {
      calls.findUserAccessByUserId.push(userId);
      return [
        {
          offer_slug: "saude-vsl",
          status: "active",
          purchase_platform: "kiwify",
          purchase_id: "ord_1",
          created_at: "2026-08-01T10:00:00.000Z",
          activated_at: "2026-08-01T10:02:00.000Z",
          access_token: "token-de-acesso-secreto-999", // Não pode vazar
        },
      ];
    },
  });

  // Verificação de chamadas com e-mail normalizado
  assert.deepEqual(calls.findUserIdByEmail, ["comprador@dominio.com"]);
  assert.deepEqual(calls.findPurchasesByEmail, ["comprador@dominio.com"]);
  assert.equal(calls.findOfferProducts, 1);
  assert.deepEqual(calls.findActiveProductGrantsByEmail, ["comprador@dominio.com"]);
  assert.deepEqual(calls.findUserAccessByUserId, ["user_uuid_12345"]);

  // Verificação de resposta
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);

  // 1. Access
  assert.equal(result.access.length, 1);
  assert.deepEqual(result.access[0], {
    offer_slug: "saude-vsl",
    status: "active",
    purchase_platform: "kiwify",
    purchase_id: "ord_1",
    created_at: "2026-08-01T10:00:00.000Z",
    activated_at: "2026-08-01T10:02:00.000Z",
  });

  // 2. Purchases
  assert.equal(result.purchases.length, 1);
  assert.deepEqual(result.purchases[0], {
    product_id: "ext_10",
    product_name: "Oferta Principal",
    amount_cents: 19700,
    currency: "BRL",
    event: "approved",
    order_id: "ord_1",
    catalog_group: "saude",
    created_at: "2026-08-01T10:00:00.000Z",
  });

  // 3. Products (Gate híbrido)
  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products[0], {
    offer_slug: "saude-vsl",
    product_key: "manual-pdf",
    title: "Manual PDF",
    state: "comprado",
  });
  assert.deepEqual(result.products[1], {
    offer_slug: "saude-vsl",
    product_key: "protocolo-sono",
    title: "Protocolo do Sono",
    state: "liberado_manual",
  });

  // PROVA DE AUDITORIA: nenhum segredo no JSON serializado
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("token-de-acesso-secreto"), false);
  assert.equal(serialized.includes("suporte@empresa.com"), false);
  assert.equal(serialized.includes("/private/manual.pdf"), false);
});

test("lookupAppsCustomer: e-mail inexistente em auth.users retorna status 200 com access vazio (anti-enumeração)", async () => {
  const calls = { findUserAccess: 0 };

  const result = await lookupAppsCustomer({
    email: "nao_existe@dominio.com",
    findUserIdByEmail: async () => null, // Sem auth.users
    findPurchasesByEmail: async () => [],
    findOfferProducts: async () => [
      { offer_slug: "oferta-a", product_key: "pdf-1", title: "PDF 1" },
    ],
    findActiveProductGrantsByEmail: async () => [],
    findUserAccessByUserId: async () => {
      calls.findUserAccess++;
      return [];
    },
  });

  assert.equal(calls.findUserAccess, 0); // Não busca user_access se userId é null
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.access, []);
  assert.deepEqual(result.purchases, []);
  assert.deepEqual(result.products, [
    { offer_slug: "oferta-a", product_key: "pdf-1", title: "PDF 1", state: "bloqueado" },
  ]);
});

test("lookupAppsCustomer: usuário existente com zero compras e zero acessos retorna mesma estrutura", async () => {
  const result = await lookupAppsCustomer({
    email: "novo_usuario@dominio.com",
    findUserIdByEmail: async () => "usr_empty_001",
    findPurchasesByEmail: async () => [],
    findOfferProducts: async () => [
      { offer_slug: "oferta-a", product_key: "pdf-1", title: "PDF 1" },
    ],
    findActiveProductGrantsByEmail: async () => [],
    findUserAccessByUserId: async () => [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.access, []);
  assert.deepEqual(result.purchases, []);
  assert.deepEqual(result.products, [
    { offer_slug: "oferta-a", product_key: "pdf-1", title: "PDF 1", state: "bloqueado" },
  ]);
});

test("lookupAppsAccess: alias idêntico a lookupAppsCustomer", async () => {
  assert.equal(lookupAppsAccess, lookupAppsCustomer);
});

// ── 6. Falhas de banco e I/O (Fail-closed) ───────────────────────────────────

test("lookupAppsCustomer: falha ao buscar userId retorna 500 com USER_LOOKUP_FAILED", async () => {
  const result = await lookupAppsCustomer({
    email: "user@dominio.com",
    findUserIdByEmail: async () => {
      throw new Error("RPC error: connection refused");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.code, APPS_LOOKUP_CODES.USER_LOOKUP_FAILED);
  assert.equal(result.error, "Falha ao verificar usuário");
});

test("lookupAppsCustomer: falha ao buscar purchases retorna 500 com PURCHASES_LOOKUP_FAILED", async () => {
  const result = await lookupAppsCustomer({
    email: "user@dominio.com",
    findUserIdByEmail: async () => "user_123",
    findPurchasesByEmail: async () => {
      throw new Error("DB error: timeout");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.code, APPS_LOOKUP_CODES.PURCHASES_LOOKUP_FAILED);
  assert.equal(result.error, "Falha ao consultar compras");
});

test("lookupAppsCustomer: falha ao buscar user_access retorna 500 com ACCESS_LOOKUP_FAILED", async () => {
  const result = await lookupAppsCustomer({
    email: "user@dominio.com",
    findUserIdByEmail: async () => "user_123",
    findPurchasesByEmail: async () => [],
    findOfferProducts: async () => [],
    findActiveProductGrantsByEmail: async () => [],
    findUserAccessByUserId: async () => {
      throw new Error("DB error: access table unreachable");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.code, APPS_LOOKUP_CODES.ACCESS_LOOKUP_FAILED);
  assert.equal(result.error, "Falha ao consultar acesso");
});
