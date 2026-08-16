import assert from "node:assert/strict";
import test from "node:test";
import {
  SPY_CONFIG_PATH,
  SPY_LEITURAS_PATH,
  SPY_LOGIN_PATH,
  SPY_OFERTAS_PATH,
  createSpyOferta,
  deleteSpyLeitura,
  deleteSpyOferta,
  saveSpyLeiturasBatch,
  updateSpyConfig,
  updateSpyLeitura,
  updateSpyOferta,
} from "../src/lib/sistemas/spy/mutations-client.mjs";

const config = { origin: "https://spy.example.test", password: "senha-do-time" };

function loginResponse({ status = 200, cookie = "spy_session=abc.def; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000" } = {}) {
  const headers = new Headers();
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ ok: status === 200 }), { status, headers });
}

function opResponse(body, init = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

// Roteador genérico por (pathname, method) — cobre login + as 7 rotas de mutação.
function stubFetch(handlers = {}) {
  const { onLogin, onOp } = handlers;
  return async (url, init) => {
    if (url.pathname === SPY_LOGIN_PATH) return (onLogin ?? (async () => loginResponse()))(url, init);
    if (onOp) return onOp(url, init);
    throw new Error(`caminho inesperado sem onOp configurado: ${url.pathname}${url.search}`);
  };
}

const ofertaValida = {
  id: "o1",
  nome: "Oferta 1",
  formato: "vsl",
  nicho: "saude",
  idioma: "pt",
  link: "https://ex.test/1",
  cloaker: "sim",
  tipo_produto: "infoproduto",
};

const ofertaRowWire = {
  id: "o1",
  nome: "Oferta 1",
  formato: "vsl",
  nicho: "saude",
  idioma: "pt",
  link: "https://ex.test/1",
  cloaker: "sim",
  tipo_produto: "infoproduto",
};

const leituraRowWire = { id: "l1", ofertaId: "o1", data: "2026-08-01", periodo: "manha", ads: 50 };

// ---------------------------------------------------------------------------
// createSpyOferta — POST /api/ofertas
// ---------------------------------------------------------------------------

test("createSpyOferta: credencial ausente devolve not_configured e NUNCA chama fetch", async () => {
  let calls = 0;
  const result = await createSpyOferta(ofertaValida, {
    origin: config.origin,
    password: "",
    fetchImpl: async () => { calls += 1; return opResponse(ofertaRowWire); },
  });
  assert.deepEqual(result, { kind: "not_configured", reason: "MISSING_CREDENTIALS", mutatedAt: null, data: null });
  assert.equal(calls, 0);
});

test("createSpyOferta: payload válido faz login + POST com body correto, resposta validada e tipo_produto vira tipoProduto", async () => {
  let opCall;
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({
      onOp: async (url, init) => {
        opCall = { url, init };
        return opResponse(ofertaRowWire, { status: 201 });
      },
    }),
  });
  assert.equal(result.kind, "success");
  assert.equal(opCall.url.pathname, SPY_OFERTAS_PATH);
  assert.equal(opCall.init.method, "POST");
  assert.equal(opCall.init.redirect, "manual");
  assert.match(opCall.init.headers.cookie, /^spy_session=abc\.def$/);
  assert.deepEqual(JSON.parse(opCall.init.body), ofertaValida);
  assert.equal(result.data.tipoProduto, "infoproduto");
  assert.equal(typeof result.mutatedAt, "string");
});

test("createSpyOferta: id ausente falha fechado ANTES de qualquer chamada de rede", async () => {
  let calls = 0;
  const result = await createSpyOferta(
    { nome: "sem id" },
    { ...config, fetchImpl: async () => { calls += 1; return opResponse(ofertaRowWire); } },
  );
  assert.equal(result.kind, "error");
  assert.equal(result.code, "OFERTA_CREATE_VALIDATION_INVALID");
  assert.equal(calls, 0, "payload local inválido não pode gerar rede real");
});

test("createSpyOferta: nome ausente/vazio falha fechado", async () => {
  const semNome = await createSpyOferta({ id: "o1", nome: "" }, config);
  assert.equal(semNome.code, "OFERTA_CREATE_VALIDATION_INVALID");
  const nomeSoEspaco = await createSpyOferta({ id: "o1", nome: "   " }, config);
  assert.equal(nomeSoEspaco.code, "OFERTA_CREATE_VALIDATION_INVALID");
});

test("createSpyOferta: link sem http(s):// falha fechado", async () => {
  const result = await createSpyOferta({ ...ofertaValida, link: "javascript:alert(1)" }, config);
  assert.equal(result.code, "OFERTA_CREATE_VALIDATION_INVALID");
});

test("createSpyOferta: cloaker fora da lista fechada falha fechado; vazio/null/undefined são aceitos", async () => {
  const invalido = await createSpyOferta({ ...ofertaValida, cloaker: "quem_sabe" }, config);
  assert.equal(invalido.code, "OFERTA_CREATE_VALIDATION_INVALID");

  for (const valor of [undefined, null, ""]) {
    const result = await createSpyOferta(
      { ...ofertaValida, cloaker: valor },
      { ...config, fetchImpl: stubFetch({ onOp: async () => opResponse({ ...ofertaRowWire, cloaker: null }) }) },
    );
    assert.equal(result.kind, "success", `cloaker=${JSON.stringify(valor)} deveria ser aceito`);
  }
});

test("createSpyOferta: tipo_produto fora da lista fechada falha fechado", async () => {
  const result = await createSpyOferta({ ...ofertaValida, tipo_produto: "fisico" }, config);
  assert.equal(result.code, "OFERTA_CREATE_VALIDATION_INVALID");
});

test("createSpyOferta: 409 (nome duplicado) vira OFERTA_CREATE_CONFLICT", async () => {
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "ja existe" }), { status: 409 }) }),
  });
  assert.deepEqual(result, { kind: "error", code: "OFERTA_CREATE_CONFLICT", mutatedAt: null, data: null });
});

test("createSpyOferta: resposta fora do schema (nome com tipo errado) falha fechado, não vira sucesso parcial", async () => {
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => opResponse({ ...ofertaRowWire, nome: 123 }) }),
  });
  assert.deepEqual(result, { kind: "error", code: "OFERTA_CREATE_RESPONSE_SCHEMA_INVALID", mutatedAt: null, data: null });
});

// ---------------------------------------------------------------------------
// updateSpyOferta — PATCH /api/ofertas?id=
// ---------------------------------------------------------------------------

test("updateSpyOferta: patch sem nenhum campo editável falha fechado ANTES da rede", async () => {
  let calls = 0;
  const result = await updateSpyOferta("o1", {}, { ...config, fetchImpl: async () => { calls += 1; return opResponse(ofertaRowWire); } });
  assert.equal(result.code, "OFERTA_UPDATE_VALIDATION_INVALID");
  assert.equal(calls, 0);
});

test("updateSpyOferta: PATCH parcial só envia campos presentes no patch (checagem `in`, não `!== undefined`)", async () => {
  let opCall;
  const result = await updateSpyOferta("o1", { link: "https://novo.test" }, {
    ...config,
    fetchImpl: stubFetch({
      onOp: async (url, init) => { opCall = { url, init }; return opResponse(ofertaRowWire); },
    }),
  });
  assert.equal(result.kind, "success");
  assert.equal(opCall.url.pathname, SPY_OFERTAS_PATH);
  assert.equal(opCall.url.searchParams.get("id"), "o1");
  assert.equal(opCall.init.method, "PATCH");
  assert.deepEqual(JSON.parse(opCall.init.body), { link: "https://novo.test" });
});

test("updateSpyOferta: id vazio/nulo/undefined falha fechado ANTES da rede", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse(ofertaRowWire); };
  for (const id of ["", null, undefined]) {
    const result = await updateSpyOferta(id, { nome: "x" }, { ...config, fetchImpl });
    assert.equal(result.code, "OFERTA_UPDATE_VALIDATION_INVALID", `id=${JSON.stringify(id)}`);
  }
  assert.equal(calls, 0);
});

test("updateSpyOferta: 404 (oferta inexistente) vira OFERTA_UPDATE_NOT_FOUND", async () => {
  const result = await updateSpyOferta("inexistente", { nome: "x" }, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "nao encontrada" }), { status: 404 }) }),
  });
  assert.equal(result.code, "OFERTA_UPDATE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// deleteSpyOferta — DELETE /api/ofertas?id=
// ---------------------------------------------------------------------------

test("deleteSpyOferta: id vazio/nulo/undefined falha fechado — NUNCA monta um DELETE com id vazio", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse({ ok: true }); };
  for (const id of ["", null, undefined]) {
    const result = await deleteSpyOferta(id, { ...config, fetchImpl });
  assert.equal(result.code, "OFERTA_DELETE_VALIDATION_INVALID", `id=${JSON.stringify(id)}`);
  }
  assert.equal(calls, 0, "id inválido não pode gerar nenhuma chamada de rede, nem de login");
});

test("deleteSpyOferta: sucesso chama DELETE com o id certo na query e valida {ok:true}", async () => {
  let opCall;
  const result = await deleteSpyOferta("o1", {
    ...config,
    fetchImpl: stubFetch({ onOp: async (url, init) => { opCall = { url, init }; return opResponse({ ok: true }); } }),
  });
  assert.deepEqual(result.data, { ok: true });
  assert.equal(opCall.url.searchParams.get("id"), "o1");
  assert.equal(opCall.init.method, "DELETE");
});

test("deleteSpyOferta: 404 vira OFERTA_DELETE_NOT_FOUND", async () => {
  const result = await deleteSpyOferta("o1", {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "nao encontrada" }), { status: 404 }) }),
  });
  assert.equal(result.code, "OFERTA_DELETE_NOT_FOUND");
});

test("deleteSpyOferta: resposta fora do schema ({ok:false} ou corpo vazio) falha fechado", async () => {
  const semOk = await deleteSpyOferta("o1", {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => opResponse({ ok: false }) }),
  });
  assert.equal(semOk.code, "OFERTA_DELETE_RESPONSE_SCHEMA_INVALID");
});

// ---------------------------------------------------------------------------
// saveSpyLeiturasBatch — POST /api/leituras
// ---------------------------------------------------------------------------

test("saveSpyLeiturasBatch: lote vazio falha fechado ANTES da rede", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse({ leituras: [] }); };
  const resultVazio = await saveSpyLeiturasBatch([], { ...config, fetchImpl });
  assert.equal(resultVazio.code, "LEITURAS_BATCH_VALIDATION_INVALID");
  const resultNaoArray = await saveSpyLeiturasBatch(null, { ...config, fetchImpl });
  assert.equal(resultNaoArray.code, "LEITURAS_BATCH_VALIDATION_INVALID");
  assert.equal(calls, 0, "lote vazio/inválido não pode gerar rede real — é dado de produção");
});

test("saveSpyLeiturasBatch: item malformado (data fora do formato, periodo inválido, ads negativo) falha fechado, lote inteiro rejeitado", async () => {
  const item = { id: "l1", ofertaId: "o1", data: "2026-08-01", periodo: "manha", ads: 10 };
  const casos = [
    { ...item, data: "01-08-2026" },
    { ...item, periodo: "tarde" },
    { ...item, ads: -1 },
    { ...item, ads: 1.5 },
    { ...item, id: "" },
    { ...item, ofertaId: "" },
  ];
  for (const itemRuim of casos) {
    const result = await saveSpyLeiturasBatch([item, itemRuim], config);
    assert.equal(result.code, "LEITURAS_BATCH_VALIDATION_INVALID", JSON.stringify(itemRuim));
  }
});

test("saveSpyLeiturasBatch: lote válido faz POST com {itens} e devolve leituras validadas", async () => {
  let opCall;
  const itens = [{ id: "l1", ofertaId: "o1", data: "2026-08-01", periodo: "manha", ads: 50 }];
  const result = await saveSpyLeiturasBatch(itens, {
    ...config,
    fetchImpl: stubFetch({
      onOp: async (url, init) => { opCall = { url, init }; return opResponse({ leituras: [leituraRowWire] }); },
    }),
  });
  assert.equal(result.kind, "success");
  assert.equal(opCall.url.pathname, SPY_LEITURAS_PATH);
  assert.deepEqual(JSON.parse(opCall.init.body), { itens });
  assert.deepEqual(result.data.leituras, [leituraRowWire]);
});

test("saveSpyLeiturasBatch: 400 (ofertaId inexistente, FK) vira LEITURAS_BATCH_REQUEST_INVALID", async () => {
  const itens = [{ id: "l1", ofertaId: "inexistente", data: "2026-08-01", periodo: "manha", ads: 1 }];
  const result = await saveSpyLeiturasBatch(itens, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "ofertaId inexistente" }), { status: 400 }) }),
  });
  assert.equal(result.code, "LEITURAS_BATCH_REQUEST_INVALID");
});

// ---------------------------------------------------------------------------
// updateSpyLeitura — PATCH /api/leituras?id=
// ---------------------------------------------------------------------------

test("updateSpyLeitura: id vazio ou ads inválido falham fechado ANTES da rede", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse(leituraRowWire); };
  assert.equal((await updateSpyLeitura("", 10, { ...config, fetchImpl })).code, "LEITURA_UPDATE_VALIDATION_INVALID");
  assert.equal((await updateSpyLeitura("l1", -1, { ...config, fetchImpl })).code, "LEITURA_UPDATE_VALIDATION_INVALID");
  assert.equal((await updateSpyLeitura("l1", 1.5, { ...config, fetchImpl })).code, "LEITURA_UPDATE_VALIDATION_INVALID");
  assert.equal((await updateSpyLeitura("l1", "10", { ...config, fetchImpl })).code, "LEITURA_UPDATE_VALIDATION_INVALID");
  assert.equal(calls, 0);
});

test("updateSpyLeitura: sucesso envia PATCH com {ads} e devolve a linha validada", async () => {
  let opCall;
  const result = await updateSpyLeitura("l1", 99, {
    ...config,
    fetchImpl: stubFetch({
      onOp: async (url, init) => { opCall = { url, init }; return opResponse({ ...leituraRowWire, ads: 99 }); },
    }),
  });
  assert.equal(opCall.url.searchParams.get("id"), "l1");
  assert.deepEqual(JSON.parse(opCall.init.body), { ads: 99 });
  assert.equal(result.data.ads, 99);
});

test("updateSpyLeitura: 404 vira LEITURA_UPDATE_NOT_FOUND", async () => {
  const result = await updateSpyLeitura("inexistente", 1, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(null, { status: 404 }) }),
  });
  assert.equal(result.code, "LEITURA_UPDATE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// deleteSpyLeitura — DELETE /api/leituras?id=
// ---------------------------------------------------------------------------

test("deleteSpyLeitura: id vazio/nulo/undefined falha fechado — NUNCA monta um DELETE com id vazio", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse({ ok: true }); };
  for (const id of ["", null, undefined]) {
    const result = await deleteSpyLeitura(id, { ...config, fetchImpl });
    assert.equal(result.code, "LEITURA_DELETE_VALIDATION_INVALID", `id=${JSON.stringify(id)}`);
  }
  assert.equal(calls, 0);
});

test("deleteSpyLeitura: sucesso e 404", async () => {
  const ok = await deleteSpyLeitura("l1", {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => opResponse({ ok: true }) }),
  });
  assert.deepEqual(ok.data, { ok: true });

  const notFound = await deleteSpyLeitura("l1", {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(null, { status: 404 }) }),
  });
  assert.equal(notFound.code, "LEITURA_DELETE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// updateSpyConfig — PUT /api/config
// ---------------------------------------------------------------------------

test("updateSpyConfig: pesos incompletos ou tolerância não-numérica falham fechado ANTES da rede", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return opResponse({ pesos: { estab: 1, vol: 1, tempo: 1 }, tolerancia: 1 }); };
  const semTempo = await updateSpyConfig({ estab: 45, vol: 30 }, 20, { ...config, fetchImpl });
  assert.equal(semTempo.code, "CONFIG_UPDATE_VALIDATION_INVALID");
  const tolNaoNumero = await updateSpyConfig({ estab: 45, vol: 30, tempo: 25 }, "20", { ...config, fetchImpl });
  assert.equal(tolNaoNumero.code, "CONFIG_UPDATE_VALIDATION_INVALID");
  assert.equal(calls, 0);
});

test("updateSpyConfig: tolerância pode ser NÃO-INTEIRA (contrato real de PUT diverge do GET) — não falha fechado à toa", async () => {
  const result = await updateSpyConfig({ estab: 45, vol: 30, tempo: 25 }, 12.5, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => opResponse({ pesos: { estab: 45, vol: 30, tempo: 25 }, tolerancia: 12.5 }) }),
  });
  assert.equal(result.kind, "success");
  assert.equal(result.data.tolerancia, 12.5);
});

test("updateSpyConfig: sucesso envia PUT com {pesos, tolerancia} exatos", async () => {
  let opCall;
  const result = await updateSpyConfig({ estab: 45, vol: 30, tempo: 25 }, 20, {
    ...config,
    fetchImpl: stubFetch({
      onOp: async (url, init) => {
        opCall = { url, init };
        return opResponse({ pesos: { estab: 45, vol: 30, tempo: 25 }, tolerancia: 20 });
      },
    }),
  });
  assert.equal(opCall.url.pathname, SPY_CONFIG_PATH);
  assert.equal(opCall.init.method, "PUT");
  assert.deepEqual(JSON.parse(opCall.init.body), { pesos: { estab: 45, vol: 30, tempo: 25 }, tolerancia: 20 });
  assert.deepEqual(result.data, { pesos: { estab: 45, vol: 30, tempo: 25 }, tolerancia: 20 });
});

test("updateSpyConfig: 404 (config nao inicializada) vira CONFIG_UPDATE_NOT_FOUND", async () => {
  const result = await updateSpyConfig({ estab: 1, vol: 1, tempo: 1 }, 1, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "config nao inicializada" }), { status: 404 }) }),
  });
  assert.equal(result.code, "CONFIG_UPDATE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// Cenários transversais: 401 no LOGIN vs 401 na OPERAÇÃO, redirect, timeout — cobertos 1x com
// createSpyOferta (o mecanismo é compartilhado por todas as 7 funções via performSpyMutation).
// ---------------------------------------------------------------------------

test("401 no LOGIN vira LOGIN_UNAUTHORIZED e NUNCA chama a operação; distinto de 401 NA operação", async () => {
  let opCalls = 0;
  const senhaErrada = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({
      onLogin: async () => new Response(null, { status: 401 }),
      onOp: async () => { opCalls += 1; return opResponse(ofertaRowWire); },
    }),
  });
  assert.equal(senhaErrada.code, "LOGIN_UNAUTHORIZED");
  assert.equal(opCalls, 0, "login recusado não pode seguir pra operação");

  const sessaoRecusada = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(null, { status: 401 }) }),
  });
  assert.equal(sessaoRecusada.code, "OFERTA_CREATE_UNAUTHORIZED");
  assert.notEqual(senhaErrada.code, sessaoRecusada.code, "os dois cenários NÃO podem colidir no mesmo código");
});

test("redirect não é seguido em nenhuma das duas chamadas — 3xx vira erro tipado", async () => {
  const naLogin = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onLogin: async () => new Response(null, { status: 302, headers: { location: "https://evil.test/" } }) }),
  });
  assert.equal(naLogin.code, "LOGIN_UNEXPECTED_REDIRECT");

  const naOperacao = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(null, { status: 302, headers: { location: "https://evil.test/" } }) }),
  });
  assert.equal(naOperacao.code, "OFERTA_CREATE_UNEXPECTED_REDIRECT");
});

test("timeout (AbortError) vira erro tipado TIMEOUT", async () => {
  const result = await createSpyOferta(ofertaValida, {
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
  assert.deepEqual(result, { kind: "error", code: "TIMEOUT", mutatedAt: null, data: null });
});

test("falha de rede (fetch rejeita) vira erro tipado NETWORK_ERROR", async () => {
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: async () => { throw new Error("ECONNRESET"); },
  });
  assert.deepEqual(result, { kind: "error", code: "NETWORK_ERROR", mutatedAt: null, data: null });
});

test("JSON inválido no corpo da resposta de operação vira erro tipado, não quebra", async () => {
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => opResponse("{not json") }),
  });
  assert.equal(result.code, "OFERTA_CREATE_RESPONSE_JSON_INVALID");
});

test("host fora do allowlist (http em vez de https) falha fechado", async () => {
  const result = await createSpyOferta(ofertaValida, { ...config, origin: "http://spy.example.test" });
  assert.equal(result.code, "BASE_URL_INVALID");
});

test("5xx do upstream vira erro tipado *_UPSTREAM_ERROR", async () => {
  const result = await createSpyOferta(ofertaValida, {
    ...config,
    fetchImpl: stubFetch({ onOp: async () => new Response(JSON.stringify({ erro: "erro interno" }), { status: 500 }) }),
  });
  assert.equal(result.code, "OFERTA_CREATE_UPSTREAM_ERROR");
});
