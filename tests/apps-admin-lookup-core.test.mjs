import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  APPS_LOOKUP_CORE_PATH,
  AppsLookupCoreError,
  CORE_SUBJECT_SENTINEL,
  criarFindersDoCore,
  handleAppsLookupRequest,
  offerProductInputs,
  parseCoreLookupBody,
  validateAppsLookupUrl,
} from "../src/lib/sistemas/apps/lookup-core.mjs";
import { lookupAppsCustomer } from "../src/lib/sistemas/apps/lookup.mjs";

const ROUTE_PATH = new URL("../src/app/api/admin/apps/lookup/route.ts", import.meta.url);
const CORE_PATH = new URL("../src/lib/sistemas/apps/lookup-core.mjs", import.meta.url);
const EDGE_PATH = new URL("../supabase/functions/apps-lookup-read/index.ts", import.meta.url);
const MIGRATION_PATH = new URL(
  "../supabase/migrations/20260817201547_read_apps_lookup_by_email.sql",
  import.meta.url,
);

const HOST = "givqkglqwdizrpityafz.supabase.co";
const URL_OK = `https://${HOST}${APPS_LOOKUP_CORE_PATH}`;
const KEY = "chave-de-teste-do-banco";
const SECRET = "segredo-cron-de-teste";
const CONFIG = { url: URL_OK, writerKey: KEY, hostAllowlist: HOST };

function coreBody(overrides = {}) {
  return {
    resolved: true,
    access: [
      {
        offer_slug: "metodo-alpha",
        status: "active",
        origin_created_at: "2026-05-10T12:00:00+00:00",
        origin_updated_at: "2026-05-11T12:00:00+00:00",
        migrated_at: "2026-08-01T00:00:00+00:00",
      },
    ],
    purchases: [
      {
        order_id: "ord_1",
        product_id: "prod_ext_1",
        product_key: "modulo-1",
        offer_slug: "metodo-alpha",
        catalog_group: "principal",
        event_type: "purchase.approved",
        amount_cents: 19700,
        gateway: "kiwify",
        source_event_at: "2026-05-10T12:00:00+00:00",
        received_at: "2026-05-10T12:00:05+00:00",
      },
    ],
    products: [
      {
        offer_slug: "metodo-alpha",
        product_key: "modulo-1",
        title: "Módulo 1",
        status: "active",
        updated_at: "2026-05-10T12:00:10+00:00",
      },
      {
        offer_slug: "metodo-alpha",
        product_key: "bonus-manual",
        title: "Bônus manual",
        status: "active",
        updated_at: "2026-06-01T09:00:00+00:00",
      },
      {
        offer_slug: "metodo-alpha",
        product_key: "modulo-revogado",
        title: "Módulo revogado",
        status: "revoked",
        updated_at: "2026-06-02T09:00:00+00:00",
      },
    ],
    ...overrides,
  };
}

/** fetch de mentira que registra as chamadas e devolve o corpo do Core. */
function mockFetch(body = coreBody(), status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

// ── 1. Allowlist de host e forma da URL (fail-closed, molde do emitter) ───────

test("validateAppsLookupUrl aceita só HTTPS, no path da edge function e em host da allowlist", () => {
  const url = validateAppsLookupUrl(URL_OK, HOST);
  assert.equal(url.hostname, HOST);
  assert.equal(url.pathname, APPS_LOOKUP_CORE_PATH);
});

test("validateAppsLookupUrl recusa http, porta, credencial, query, hash e path errado", () => {
  const recusadas = [
    `http://${HOST}${APPS_LOOKUP_CORE_PATH}`,
    `https://${HOST}:8443${APPS_LOOKUP_CORE_PATH}`,
    `https://user:pass@${HOST}${APPS_LOOKUP_CORE_PATH}`,
    `https://${HOST}${APPS_LOOKUP_CORE_PATH}?email=a@b.com`,
    `https://${HOST}${APPS_LOOKUP_CORE_PATH}#frag`,
    `https://${HOST}/functions/v1/outra-coisa`,
    "não-é-url",
    "",
    null,
  ];
  for (const raw of recusadas) {
    assert.throws(
      () => validateAppsLookupUrl(raw, HOST),
      (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_URL_INVALID",
      `deveria recusar ${String(raw)}`,
    );
  }
});

test("validateAppsLookupUrl é fail-closed: host fora da allowlist não passa (allowlist vazia recusa tudo)", () => {
  for (const allowlist of ["", null, undefined, "outro.supabase.co", []]) {
    assert.throws(
      () => validateAppsLookupUrl(URL_OK, allowlist),
      (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_HOST_NOT_ALLOWLISTED",
    );
  }
});

test("criarFindersDoCore derruba na criação quando falta writerKey ou a URL é inválida", () => {
  assert.throws(
    () => criarFindersDoCore({ url: URL_OK, writerKey: "", hostAllowlist: HOST, fetch: async () => new Response("{}") }),
    (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_WRITER_KEY_MISSING",
  );
  assert.throws(
    () => criarFindersDoCore({ url: "", writerKey: KEY, hostAllowlist: HOST, fetch: async () => new Response("{}") }),
    (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_URL_INVALID",
  );
});

// ── 2. UMA chamada HTTP por lookup, não cinco ────────────────────────────────

test("um lookup completo faz UMA única chamada HTTP à edge function", async () => {
  const { fetchImpl, calls } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const result = await lookupAppsCustomer({ email: "Cliente@Exemplo.com", ...finders });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1, "as 5 finders devem compartilhar a mesma resposta memoizada");
  assert.equal(calls[0].url, URL_OK);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(calls[0].init.headers["x-ngv-core-key"], KEY);
  // o e-mail sobe normalizado em minúsculas, no corpo — nunca na URL
  assert.equal(calls[0].init.body, JSON.stringify({ email: "cliente@exemplo.com" }));
});

test("cada finder lê a fatia correspondente do mesmo corpo", async () => {
  const { fetchImpl } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  assert.equal(await finders.findUserIdByEmail("cliente@exemplo.com"), CORE_SUBJECT_SENTINEL);
  const purchases = await finders.findPurchasesByEmail("cliente@exemplo.com");
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].order_id, "ord_1");
  const grants = await finders.findActiveProductGrantsByEmail("cliente@exemplo.com");
  assert.deepEqual(grants.map((g) => g.product_key), ["modulo-1", "bonus-manual", "modulo-revogado"]);
  const access = await finders.findUserAccessByUserId(CORE_SUBJECT_SENTINEL);
  assert.equal(access.length, 1);
  assert.equal(access[0].offer_slug, "metodo-alpha");
});

test("e-mail que não resolve devolve userId nulo e listas vazias, sem erro", async () => {
  const { fetchImpl, calls } = mockFetch({ resolved: false, access: [], purchases: [], products: [] });
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const result = await lookupAppsCustomer({ email: "ninguem@exemplo.com", ...finders });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.access, []);
  assert.deepEqual(result.purchases, []);
  assert.deepEqual(result.products, []);
  assert.equal(calls.length, 1);
});

test("estado do produto: comprado vence grant, grant sem compra é liberado_manual, revogado é bloqueado", async () => {
  const { fetchImpl } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const result = await lookupAppsCustomer({ email: "cliente@exemplo.com", ...finders });

  assert.deepEqual(
    result.products.map((p) => [p.product_key, p.state]),
    [
      ["modulo-1", "comprado"],
      ["bonus-manual", "liberado_manual"],
      ["modulo-revogado", "bloqueado"],
    ],
  );
});

test("offerProductInputs casa external_product_id por (offer_slug, product_key)", () => {
  const inputs = offerProductInputs(
    [
      { offer_slug: "a", product_key: "k1", title: "K1" },
      { offer_slug: "b", product_key: "k1", title: "outro K1" },
    ],
    [{ offer_slug: "a", product_key: "k1", product_id: "ext-1" }],
  );
  assert.equal(inputs[0].external_product_id, "ext-1");
  assert.equal(inputs[1].external_product_id, null, "product_key igual em outra oferta não pode casar");
});

// ── 3. PII: o e-mail entra e NÃO sai ─────────────────────────────────────────

test("resposta do lookup NÃO vaza e-mail, access_token nem outra PII do cliente", async () => {
  // O Core, por contrato, não devolve nada disso — mas se um dia devolver, a projeção
  // do painel tem que continuar segurando. Corpo contaminado de propósito:
  const contaminado = coreBody();
  contaminado.access[0].email = "cliente@exemplo.com";
  contaminado.access[0].access_token = "tok_super_secreto";
  contaminado.access[0].core_user_id = "11111111-1111-4111-8111-111111111111";
  contaminado.purchases[0].email = "cliente@exemplo.com";
  contaminado.purchases[0].cpf = "000.000.000-00";
  contaminado.purchases[0].telefone = "+55 11 99999-9999";
  contaminado.products[0].subject_id = "11111111-1111-4111-8111-111111111111";
  contaminado.products[0].granted_by = "operador@ngvdigital.com.br";

  const { fetchImpl } = mockFetch(contaminado);
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const result = await lookupAppsCustomer({ email: "cliente@exemplo.com", ...finders });
  const serialized = JSON.stringify(result).toLowerCase();

  for (const proibido of [
    "email",
    "@exemplo.com",
    "cpf",
    "telefone",
    "phone",
    "senha",
    "password",
    "token",
    "access_token",
    "granted_by",
    "subject_id",
    "core_user_id",
    "writerkey",
    KEY,
  ]) {
    assert.ok(
      !serialized.includes(proibido.toLowerCase()),
      `a resposta do lookup não pode conter "${proibido}" — vazamento de PII/credencial`,
    );
  }
});

test("a resposta da rota também não vaza PII nem a credencial de ingress", async () => {
  const contaminado = coreBody();
  contaminado.access[0].access_token = "tok_super_secreto";
  contaminado.purchases[0].email = "cliente@exemplo.com";

  const { fetchImpl } = mockFetch(contaminado);
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const response = await handleAppsLookupRequest({
    authHeader: `Bearer ${SECRET}`,
    email: "cliente@exemplo.com",
    secret: SECRET,
    finders,
  });

  const serialized = JSON.stringify(response.body).toLowerCase();
  assert.equal(response.status, 200);
  for (const proibido of ["email", "access_token", "tok_super_secreto", KEY]) {
    assert.ok(!serialized.includes(proibido.toLowerCase()), `corpo da rota não pode conter "${proibido}"`);
  }
});

test("o módulo do painel não tem nenhum console.* — e-mail e credencial nunca viram log", async () => {
  const source = await readFile(CORE_PATH, "utf8");
  assert.doesNotMatch(source, /console\.(log|info|warn|error|debug)/);
});

// ── 4. Timeout via AbortController — fetch que nunca resolve não pendura ─────

test("fetch que NUNCA resolve termina por timeout do AbortController próprio", async () => {
  let recebeuSignal = null;
  // Um fetch honesto respeita o signal; este só faz isso — se o módulo não abortasse,
  // a promessa nunca resolveria e o `node --test` deste arquivo travaria.
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      recebeuSignal = init.signal;
      init.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      });
    });

  const finders = criarFindersDoCore({ ...CONFIG, timeoutMs: 25, fetch: fetchImpl });

  await assert.rejects(
    () => finders.findUserIdByEmail("cliente@exemplo.com"),
    (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_TIMEOUT",
  );
  assert.ok(recebeuSignal instanceof AbortSignal, "o fetch precisa receber o signal do nosso AbortController");
  assert.equal(recebeuSignal.aborted, true, "o AbortController precisa ter disparado");
});

test("timeout no meio do lookup vira 500 controlado, não exceção vazando pra rota", async () => {
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  const finders = criarFindersDoCore({ ...CONFIG, timeoutMs: 25, fetch: fetchImpl });
  const response = await handleAppsLookupRequest({
    authHeader: `Bearer ${SECRET}`,
    email: "cliente@exemplo.com",
    secret: SECRET,
    finders,
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.code, "USER_LOOKUP_FAILED");
});

test("timeout é limitado a 10s mesmo se pedirem mais", async () => {
  let visto = null;
  const fetchImpl = async (_url, init) => {
    visto = init.signal;
    return new Response(JSON.stringify(coreBody()), { status: 200 });
  };
  const finders = criarFindersDoCore({ ...CONFIG, timeoutMs: 120_000, fetch: fetchImpl });
  await finders.findUserIdByEmail("cliente@exemplo.com");
  assert.ok(visto instanceof AbortSignal);
  const source = await readFile(CORE_PATH, "utf8");
  assert.match(source, /APPS_LOOKUP_TIMEOUT_MS = 10_000/);
  assert.match(source, /Math\.min\(APPS_LOOKUP_TIMEOUT_MS, Math\.max\(1, requestedTimeout\)\)/);
});

// ── 5. Respostas não-2xx e envelope torto ────────────────────────────────────

test("só 2xx é sucesso — 401/403/500 e redirect viram erro com o status no código", async () => {
  for (const status of [301, 302, 400, 401, 403, 500, 503]) {
    const { fetchImpl } = mockFetch(coreBody(), status);
    const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });
    await assert.rejects(
      () => finders.findUserIdByEmail("cliente@exemplo.com"),
      (error) =>
        error instanceof AppsLookupCoreError && error.code === `APPS_LOOKUP_REJECTED_${status}`,
      `status ${status} deveria ser rejeitado`,
    );
  }
});

test("envelope torto não vira zero silencioso — falha explícita", () => {
  const tortos = [
    "não é json",
    "[]",
    "null",
    JSON.stringify({ access: [], purchases: [], products: [] }), // sem `resolved`
    JSON.stringify({ resolved: "sim", access: [], purchases: [], products: [] }),
    JSON.stringify({ resolved: true, access: {}, purchases: [], products: [] }),
    JSON.stringify({ resolved: true, access: [], purchases: [], products: null }),
  ];
  for (const texto of tortos) {
    assert.throws(
      () => parseCoreLookupBody(texto),
      (error) => error instanceof AppsLookupCoreError && error.code === "APPS_LOOKUP_RESPONSE_INVALID",
      `deveria recusar ${texto}`,
    );
  }
});

// ── 6. Rota: 401 sem bearer E 200 com bearer certo (os DOIS lados) ───────────

test("rota responde 401 sem bearer, com bearer errado e com CRON_SECRET ausente", async () => {
  const { fetchImpl, calls } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });
  const base = { email: "cliente@exemplo.com", finders };

  const casos = [
    { ...base, authHeader: null, secret: SECRET },
    { ...base, authHeader: "", secret: SECRET },
    { ...base, authHeader: "Bearer errado", secret: SECRET },
    { ...base, authHeader: SECRET, secret: SECRET }, // sem o prefixo "Bearer "
    { ...base, authHeader: "Bearer undefined", secret: undefined },
    { ...base, authHeader: `Bearer ${SECRET}`, secret: "" },
    { ...base, authHeader: `Bearer ${SECRET}`, secret: "   " },
  ];

  for (const caso of casos) {
    const response = await handleAppsLookupRequest(caso);
    assert.equal(response.status, 401, `deveria negar: ${JSON.stringify(caso.authHeader)}`);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  }
  assert.equal(calls.length, 0, "auth precisa barrar ANTES de qualquer chamada ao Core");
});

test("rota responde 200 com bearer correto e devolve access/purchases/products", async () => {
  const { fetchImpl, calls } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  const response = await handleAppsLookupRequest({
    authHeader: `Bearer ${SECRET}`,
    email: "cliente@exemplo.com",
    secret: SECRET,
    finders,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(response.body.access, [
    {
      offer_slug: "metodo-alpha",
      status: "active",
      purchase_platform: null,
      purchase_id: null,
      created_at: "2026-05-10T12:00:00.000Z",
      activated_at: null,
    },
  ]);
  assert.equal(response.body.purchases.length, 1);
  assert.equal(response.body.purchases[0].order_id, "ord_1");
  assert.equal(response.body.purchases[0].currency, "BRL");
  assert.equal(response.body.products.length, 3);
});

test("rota com bearer correto e e-mail inválido devolve o 400 do módulo, sem chamar o Core", async () => {
  const { fetchImpl, calls } = mockFetch();
  const finders = criarFindersDoCore({ ...CONFIG, fetch: fetchImpl });

  for (const email of [null, "", "   ", "sem-arroba", "a@b"]) {
    const response = await handleAppsLookupRequest({
      authHeader: `Bearer ${SECRET}`,
      email,
      secret: SECRET,
      finders,
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error, "E-mail inválido");
  }
  assert.equal(calls.length, 0);
});

test("config ausente com bearer correto vira 503 (indisponível), não 200 vazio", async () => {
  const response = await handleAppsLookupRequest({
    authHeader: `Bearer ${SECRET}`,
    email: "cliente@exemplo.com",
    secret: SECRET,
    config: { url: "", writerKey: "", hostAllowlist: "" },
  });
  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "APPS_LOOKUP_WRITER_KEY_MISSING");
});

test("route.ts é adaptador fino: delega a regra e usa CRON_SECRET + as envs do Core", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /export async function GET\(request: Request\)/);
  assert.match(source, /import \{ handleAppsLookupRequest \} from "@\/lib\/sistemas\/apps\/lookup-core\.mjs"/);
  assert.match(source, /secret: process\.env\.CRON_SECRET/);
  assert.match(source, /email: searchParams\.get\("email"\)/);
  assert.match(source, /url: process\.env\.NGV_CORE_APPS_LOOKUP_URL/);
  assert.match(source, /writerKey: process\.env\.NGV_CORE_BANCO_WRITER_KEY/);
  assert.match(source, /hostAllowlist: process\.env\.NGV_CORE_HOST_ALLOWLIST/);
  assert.match(source, /NextResponse\.json\(result\.body, \{ status: result\.status \}\)/);
  assert.match(source, /export const runtime = "nodejs"/);
  // a rota não fala com banco nem com rede por conta própria, e não loga o e-mail
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /from "@\/db"/);
  assert.doesNotMatch(source, /console\./);
});

test("as duas envs novas estão documentadas no .env.example", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(env, /^NGV_CORE_APPS_LOOKUP_URL=$/m);
  assert.match(env, /^NGV_CORE_BANCO_WRITER_KEY=$/m);
});

// ── 7. Migration: SECURITY DEFINER, sem PII na saída, grants fechados ────────

test("migration cria a função no estilo do Core (sql/stable/security definer/search_path)", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");
  assert.match(sql, /create or replace function public\.read_apps_lookup_by_email\(p_email text\)/);
  assert.match(sql, /returns jsonb/);
  assert.match(sql, /language sql/);
  assert.match(sql, /stable/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path to 'pg_catalog'/);
  assert.match(sql, /from auth\.users/);
  assert.match(sql, /lower\(email\) = lower\(trim\(p_email\)\)/);
});

test("migration devolve as 4 chaves e nunca erra em e-mail inexistente", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");
  for (const chave of ["'resolved'", "'access'", "'purchases'", "'products'"]) {
    assert.match(sql, new RegExp(chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  // arrays vazios por coalesce — não existir é resposta válida, não exceção
  assert.equal(sql.match(/coalesce\(\(/g)?.length, 3);
  assert.equal(sql.match(/'\[\]'::jsonb\)/g)?.length, 3);
  assert.doesNotMatch(sql, /raise exception/i);
  assert.match(sql, /ngv_apps\.user_access ua/);
  assert.match(sql, /ngv_apps\.purchase_events pe/);
  assert.match(sql, /ngv_apps\.product_grant_state pgs/);
  assert.match(sql, /left join ngv_apps\.catalog_offers co on co\.offer_slug = pgs\.offer_slug/);
});

test("migration NÃO projeta e-mail, nome nem os uuids de pessoa no jsonb de saída", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");
  const corpo = sql.slice(sql.indexOf("select jsonb_build_object"), sql.indexOf("$function$;"));
  for (const proibido of [
    "'email'",
    "u.email",
    "'name'",
    "'cpf'",
    "'phone'",
    "'token'",
    "'access_token'",
    "'core_user_id'",
    "'legacy_user_id'",
    "'legacy_access_id'",
    "'subject_id'",
  ]) {
    assert.ok(!corpo.includes(proibido), `o jsonb de saída não pode projetar ${proibido}`);
  }
  // o e-mail só aparece como PARÂMETRO de entrada
  assert.equal(corpo.match(/p_email/g), null);
});

test("migration fecha os grants: PUBLIC/anon/authenticated fora, service_role dentro", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");
  assert.match(sql, /revoke all on function public\.read_apps_lookup_by_email\(text\) from public;/);
  assert.match(sql, /revoke all on function public\.read_apps_lookup_by_email\(text\) from anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.read_apps_lookup_by_email\(text\) to service_role;/);
  const revokeIdx = sql.indexOf("revoke all on function");
  const grantIdx = sql.indexOf("grant execute on function");
  assert.ok(revokeIdx > 0 && grantIdx > revokeIdx, "o REVOKE precisa vir antes do GRANT");
});

// ── 8. Edge function: mesmo padrão canônico de ingress do Core ───────────────

test("edge function reproduz a guarda do apps-purchase-access (POST, ingress key, sha256)", async () => {
  const source = await readFile(EDGE_PATH, "utf8");
  assert.match(source, /import \{ createClient \} from "npm:@supabase\/supabase-js@2"/);
  assert.match(source, /const json = \(status: number, value: Record<string, boolean \| string \| object>\) =>/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SECRET_KEYS"\)/);
  assert.match(source, /async function sha256\(value: string\): Promise<string>/);
  assert.match(source, /if \(request\.method !== "POST"\) return json\(405, \{ error: "method_not_allowed" \}\)/);
  assert.match(source, /request\.headers\.get\("x-ngv-core-key"\)/);
  assert.match(source, /if \(!ingressKey\) return json\(401, \{ error: "unauthorized" \}\)/);
  assert.match(source, /supabase\.rpc\("validate_ngv_core_ingress", \{\s*\n?\s*p_token_sha256: await sha256\(ingressKey\),/);
  assert.match(source, /if \(authError \|\| valid !== true\) return json\(401, \{ error: "unauthorized" \}\)/);
  assert.match(source, /\{ auth: \{ persistSession: false, autoRefreshToken: false \} \}/);
});

test("edge function usa a credencial do BANCO (banco_writer), não a de outro sistema", async () => {
  const source = await readFile(EDGE_PATH, "utf8");
  assert.match(source, /secret\("banco_writer"\)/);
  assert.doesNotMatch(source, /secret\("spy_writer"\)/);
});

test("edge function aceita exatamente { email } e chama read_apps_lookup_by_email", async () => {
  const source = await readFile(EDGE_PATH, "utf8");
  assert.match(source, /function payload\(value: unknown\): value is \{ email: string \}/);
  assert.match(source, /Object\.keys\(record\)\.length === 1/);
  assert.match(source, /typeof record\.email === "string"/);
  assert.match(source, /record\.email\.length >= 3 && record\.email\.length <= 320/);
  assert.match(source, /record\.email\.includes\("@"\)/);
  assert.match(source, /if \(!payload\(value\)\) return json\(400, \{ error: "invalid_payload" \}\)/);
  assert.match(source, /supabase\.rpc\("read_apps_lookup_by_email", \{ p_email: value\.email \}\)/);
  assert.match(source, /return json\(200, data as Record<string, boolean \| object>\)/);
});

test("edge function NUNCA loga o e-mail — nem em erro", async () => {
  const source = await readFile(EDGE_PATH, "utf8");
  assert.doesNotMatch(source, /console\./);
  assert.doesNotMatch(source, /value\.email\s*\)/); // e-mail só sai no p_email da RPC
  assert.match(source, /if \(error\) return json\(500, \{ error: "server_error" \}\)/);
  assert.match(source, /if \(data === null\) return json\(500, \{ error: "server_error" \}\)/);
});
