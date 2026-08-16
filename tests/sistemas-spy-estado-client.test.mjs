import assert from "node:assert/strict";
import test from "node:test";
import {
  SPY_ESTADO_PATH,
  SPY_LOGIN_PATH,
  fetchSpyModuleEstado,
  parseSpyModuleEstadoPayload,
} from "../src/lib/sistemas/spy/estado-client.mjs";

const config = { origin: "https://spy.example.test", password: "senha-do-time" };

const validBody = {
  ofertas: [
    { id: "o1", nome: "Oferta 1", formato: "vsl", nicho: "saude", idioma: "pt", link: "https://ex.test/1", cloaker: "sim", tipo_produto: "infoproduto" },
    { id: "o2", nome: "Oferta 2", formato: null, nicho: null, idioma: null, link: null, cloaker: null, tipo_produto: null },
  ],
  leituras: [
    { id: "l1", oferta_id: "o1", data: "2026-08-01", periodo: "manha", ads: 50 },
  ].map((l) => ({ id: l.id, ofertaId: l.oferta_id, data: l.data, periodo: l.periodo, ads: l.ads })),
  pesos: { estab: 45, vol: 30, tempo: 25 },
  tolerancia: 20,
  prontasParaModelar: ["o1"],
};

function loginResponse({ status = 200, cookie = "spy_session=abc.def; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000" } = {}) {
  const headers = new Headers();
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ ok: status === 200 }), { status, headers });
}

function estadoResponse(body, init = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function stubFetch({ onLogin, onEstado } = {}) {
  return async (url, init) => {
    if (url.pathname === SPY_LOGIN_PATH) return (onLogin ?? (async () => loginResponse()))(url, init);
    if (url.pathname === SPY_ESTADO_PATH) return (onEstado ?? (async () => estadoResponse(validBody)))(url, init);
    throw new Error(`caminho inesperado: ${url.pathname}`);
  };
}

test("env ausente (credencial) devolve not_configured e NUNCA chama fetch", async () => {
  let calls = 0;
  const result = await fetchSpyModuleEstado({
    origin: config.origin,
    password: "",
    fetchImpl: async () => { calls += 1; return estadoResponse(validBody); },
  });
  assert.deepEqual(result, { kind: "not_configured", reason: "MISSING_CREDENTIALS", fetchedAt: null, data: null });
  assert.equal(calls, 0, "credencial ausente não pode gerar rede real");
});

test("payload válido: login POST com senha, cookie extraído, GET /api/estado com o cookie, resultado validado campo a campo", async () => {
  let loginCall;
  let estadoCall;
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({
      onLogin: async (url, init) => { loginCall = { url, init }; return loginResponse(); },
      onEstado: async (url, init) => { estadoCall = { url, init }; return estadoResponse(validBody); },
    }),
  });

  assert.equal(result.kind, "success");
  assert.equal(loginCall.url.origin, config.origin);
  assert.equal(loginCall.url.pathname, SPY_LOGIN_PATH);
  assert.equal(loginCall.init.method, "POST");
  assert.equal(loginCall.init.redirect, "manual");
  assert.deepEqual(JSON.parse(loginCall.init.body), { senha: config.password });

  assert.equal(estadoCall.url.pathname, SPY_ESTADO_PATH);
  assert.equal(estadoCall.init.method, "GET");
  assert.equal(estadoCall.init.redirect, "manual");
  assert.match(estadoCall.init.headers.cookie, /^spy_session=abc\.def$/);

  assert.equal(result.data.ofertas.length, 2);
  assert.equal(result.data.ofertas[0].tipoProduto, "infoproduto");
  assert.equal(result.data.ofertas[1].formato, null);
  assert.equal(result.data.leituras[0].ads, 50);
  assert.deepEqual(result.data.pesos, { estab: 45, vol: 30, tempo: 25 });
  assert.equal(result.data.tolerancia, 20);
  assert.deepEqual(result.data.prontasParaModelar, ["o1"]);
  assert.equal(typeof result.fetchedAt, "string");
  assert.ok(!Number.isNaN(Date.parse(result.fetchedAt)));
});

test("senha incorreta (login 401) vira UNAUTHORIZED e NUNCA chama /api/estado", async () => {
  let estadoCalls = 0;
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({
      onLogin: async () => new Response(JSON.stringify({ erro: "senha incorreta" }), { status: 401 }),
      onEstado: async () => { estadoCalls += 1; return estadoResponse(validBody); },
    }),
  });
  assert.deepEqual(result, { kind: "error", code: "LOGIN_UNAUTHORIZED", fetchedAt: null, data: null });
  assert.equal(estadoCalls, 0, "login recusado não pode seguir pro /api/estado");
});

test("login limitado por rate-limit (429) vira LOGIN_RATE_LIMITED", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onLogin: async () => new Response(JSON.stringify({ erro: "muitas tentativas" }), { status: 429 }) }),
  });
  assert.deepEqual(result, { kind: "error", code: "LOGIN_RATE_LIMITED", fetchedAt: null, data: null });
});

test("login sem Set-Cookie na resposta 200 vira LOGIN_COOKIE_MISSING — nunca segue sem sessão", async () => {
  let estadoCalls = 0;
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({
      onLogin: async () => loginResponse({ cookie: null }),
      onEstado: async () => { estadoCalls += 1; return estadoResponse(validBody); },
    }),
  });
  assert.deepEqual(result, { kind: "error", code: "LOGIN_COOKIE_MISSING", fetchedAt: null, data: null });
  assert.equal(estadoCalls, 0);
});

test("sessão recusada em /api/estado (401 mesmo com cookie) vira UNAUTHORIZED", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => new Response(JSON.stringify({ erro: "sessao invalida" }), { status: 401 }) }),
  });
  assert.deepEqual(result, { kind: "error", code: "ESTADO_UNAUTHORIZED", fetchedAt: null, data: null });
});

test("redirect não é seguido em nenhuma das duas chamadas — 3xx vira erro tipado, nunca segue Location", async () => {
  const naLogin = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onLogin: async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test/" } }) }),
  });
  assert.deepEqual(naLogin, { kind: "error", code: "LOGIN_UNEXPECTED_REDIRECT", fetchedAt: null, data: null });

  const noEstado = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test/" } }) }),
  });
  assert.deepEqual(noEstado, { kind: "error", code: "ESTADO_UNEXPECTED_REDIRECT", fetchedAt: null, data: null });
});

test("timeout (AbortError) vira erro tipado TIMEOUT", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    timeoutMs: 1,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  assert.deepEqual(result, { kind: "error", code: "TIMEOUT", fetchedAt: null, data: null });
});

test("JSON inválido no corpo de /api/estado vira erro tipado, não quebra", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => estadoResponse("{not json") }),
  });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_JSON_INVALID", fetchedAt: null, data: null });
});

test("falha de rede (fetch rejeita) vira erro tipado NETWORK_ERROR", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: async () => { throw new Error("ECONNRESET"); },
  });
  assert.deepEqual(result, { kind: "error", code: "NETWORK_ERROR", fetchedAt: null, data: null });
});

test("host fora do allowlist (origin http em vez de https) falha fechado", async () => {
  const result = await fetchSpyModuleEstado({ ...config, origin: "http://spy.example.test" });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "BASE_URL_INVALID");
});

test("payload malformado (campo com tipo errado) falha fechado com RESPONSE_SCHEMA_INVALID", async () => {
  assert.throws(
    () => parseSpyModuleEstadoPayload({ ...validBody, tolerancia: "20" }),
    { code: "RESPONSE_SCHEMA_INVALID" },
  );
  assert.throws(() => parseSpyModuleEstadoPayload({ ...validBody, ofertas: "not-an-array" }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(
    () => parseSpyModuleEstadoPayload({ ...validBody, leituras: [{ ...validBody.leituras[0], periodo: "tarde" }] }),
    { code: "RESPONSE_SCHEMA_INVALID" },
  );
  assert.throws(
    () => parseSpyModuleEstadoPayload({ ...validBody, leituras: [{ ...validBody.leituras[0], ads: -1 }] }),
    { code: "RESPONSE_SCHEMA_INVALID" },
  );
  assert.throws(
    () => parseSpyModuleEstadoPayload({ ...validBody, ofertas: [{ ...validBody.ofertas[0], id: "" }] }),
    { code: "RESPONSE_SCHEMA_INVALID" },
  );

  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => estadoResponse({ ...validBody, ofertas: [{ ...validBody.ofertas[0], nome: 123 }] }) }),
  });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_SCHEMA_INVALID", fetchedAt: null, data: null });
});

// Regressão da lição da Fase 2 (Quiz): um campo com fallback silencioso (`input ?? {zeros}`)
// transformava payload incompleto em sucesso com zero, sem sinal de erro. Aqui NENHUM campo tem
// esse fallback — provamos isso pros campos mais críticos pra decisão do operador: pesos,
// tolerancia e prontasParaModelar (a lista que decide o que aparece em "prontas pra modelar").

test("pesos AUSENTE falha fechado — não vira zero silencioso", async () => {
  const semPesos = { ...validBody };
  delete semPesos.pesos;
  const result = await fetchSpyModuleEstado({ ...config, fetchImpl: stubFetch({ onEstado: async () => estadoResponse(semPesos) }) });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
  assert.equal(result.data, null);
});

test("pesos NULL falha fechado — não vira zero silencioso", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => estadoResponse({ ...validBody, pesos: null }) }),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
  assert.equal(result.data, null);
});

test("tolerancia AUSENTE falha fechado — não vira zero silencioso", async () => {
  const semTolerancia = { ...validBody };
  delete semTolerancia.tolerancia;
  const result = await fetchSpyModuleEstado({ ...config, fetchImpl: stubFetch({ onEstado: async () => estadoResponse(semTolerancia) }) });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

test("tolerancia NULL falha fechado — não vira zero silencioso", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => estadoResponse({ ...validBody, tolerancia: null }) }),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

test("prontasParaModelar AUSENTE falha fechado — não vira lista vazia silenciosa", async () => {
  const semProntas = { ...validBody };
  delete semProntas.prontasParaModelar;
  const result = await fetchSpyModuleEstado({ ...config, fetchImpl: stubFetch({ onEstado: async () => estadoResponse(semProntas) }) });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
  assert.equal(result.data, null, "sem isso, a UI mostraria 'nenhuma oferta pronta' como se fosse fato, não falha");
});

test("prontasParaModelar NULL falha fechado — não vira lista vazia silenciosa", async () => {
  const result = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => estadoResponse({ ...validBody, prontasParaModelar: null }) }),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
  assert.equal(result.data, null);
});

test("ofertas AUSENTE falha fechado — não vira lista vazia silenciosa", async () => {
  const semOfertas = { ...validBody };
  delete semOfertas.ofertas;
  const result = await fetchSpyModuleEstado({ ...config, fetchImpl: stubFetch({ onEstado: async () => estadoResponse(semOfertas) }) });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

test("leituras AUSENTE falha fechado — não vira lista vazia silenciosa", async () => {
  const semLeituras = { ...validBody };
  delete semLeituras.leituras;
  const result = await fetchSpyModuleEstado({ ...config, fetchImpl: stubFetch({ onEstado: async () => estadoResponse(semLeituras) }) });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

// Regressão do achado do gate held-out (2026-08-16): antes, senha errada no login e
// sessão recusada no /api/estado devolviam ambos "UNAUTHORIZED", tornando impossível
// distinguir em produção "corrigir SPY_DASHBOARD_PASSWORD aqui" de "o Spy rejeitou a
// própria sessão que emitiu — escalar para o dono do Spy". Donos e correções diferentes.
test("falha de LOGIN e falha de ESTADO sao DISTINGUIVEIS (regressao do gate)", async () => {
  const senhaErrada = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onLogin: async () => new Response(null, { status: 401 }) }),
  });
  const sessaoRecusada = await fetchSpyModuleEstado({
    ...config,
    fetchImpl: stubFetch({ onEstado: async () => new Response(null, { status: 401 }) }),
  });

  assert.equal(senhaErrada.code, "LOGIN_UNAUTHORIZED");
  assert.equal(sessaoRecusada.code, "ESTADO_UNAUTHORIZED");
  assert.notEqual(senhaErrada.code, sessaoRecusada.code, "os dois cenarios NAO podem colidir no mesmo codigo");
});
