import assert from "node:assert/strict";
import test from "node:test";
import {
  CURSOS_PUSH_PATH,
  sendCursosPushCampaign,
  validateCursosPushInput,
} from "../src/lib/sistemas/cursos/push-client.mjs";

const config = { origin: "https://cursos.example.test", secret: "segredo-do-admin" };

const validInput = {
  title: "Nova aula disponível!",
  message: "Assista agora.",
  imageUrl: "https://cdn.example.test/aula.jpg",
  launchUrl: "/courses/skyvault?lesson=xyz",
  buttons: [{ text: "Assistir agora", url: "/courses/skyvault" }],
  segment: "total",
  scheduleTime: "20:00",
};

function okResponse(body = { ok: true, id: "onesignal-id-123", recipients: 42 }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function stubFetch(handler) {
  return async (url, init) => handler(url, init);
}

// --- env ausente ---

test("secret ausente devolve not_configured e NUNCA chama fetch", async () => {
  let calls = 0;
  const result = await sendCursosPushCampaign(validInput, {
    origin: config.origin,
    secret: "",
    fetchImpl: async () => { calls += 1; return okResponse(); },
  });
  assert.deepEqual(result, { kind: "not_configured", reason: "MISSING_CREDENTIALS", sentAt: null, data: null });
  assert.equal(calls, 0, "credencial ausente não pode gerar rede real");
});

// --- payload válido ---

test("payload válido: POST com secret no header, body correto, sucesso validado campo a campo", async () => {
  let call;
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async (url, init) => {
      call = { url, init };
      return okResponse();
    }),
  });

  assert.equal(result.kind, "success");
  assert.equal(call.url.origin, config.origin);
  assert.equal(call.url.pathname, CURSOS_PUSH_PATH);
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.redirect, "manual");
  assert.equal(call.init.headers["x-admin-secret"], config.secret);

  const sentBody = JSON.parse(call.init.body);
  assert.equal(sentBody.title, "Nova aula disponível!");
  assert.equal(sentBody.launchUrl, "/courses/skyvault?lesson=xyz");
  assert.equal(sentBody.segment, "total");
  assert.equal(sentBody.scheduleTime, "20:00");
  assert.equal(sentBody.buttons.length, 1);

  assert.equal(result.data.id, "onesignal-id-123");
  assert.equal(result.data.recipients, 42);
  assert.equal(typeof result.sentAt, "string");
  assert.ok(!Number.isNaN(Date.parse(result.sentAt)));
});

test("message vazio recebe DEFAULT documentado pro título (comportamento do route.ts real, não fallback silencioso de campo obrigatório)", async () => {
  let call;
  const { message, ...rest } = validInput;
  const result = await sendCursosPushCampaign(rest, {
    ...config,
    fetchImpl: stubFetch(async (url, init) => { call = { url, init }; return okResponse(); }),
  });
  assert.equal(result.kind, "success");
  const sentBody = JSON.parse(call.init.body);
  assert.equal(sentBody.message, rest.title, "sem message, o payload enviado usa o título — igual ao route.ts real");
});

// --- payload malformado: cada campo obrigatório falha fechado, NUNCA chama fetch ---

test("título ausente falha fechado com VALIDATE_TITLE_REQUIRED — não chama fetch", async () => {
  let calls = 0;
  const { title, ...rest } = validInput;
  const result = await sendCursosPushCampaign(rest, {
    ...config,
    fetchImpl: async () => { calls += 1; return okResponse(); },
  });
  assert.deepEqual(result, { kind: "error", code: "VALIDATE_TITLE_REQUIRED", sentAt: null, data: null });
  assert.equal(calls, 0);
});

test("título string vazia falha fechado — não é tratado como 'sem título'/omitido silenciosamente", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, title: "   " }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_TITLE_REQUIRED");
});

test("título com tipo errado (number) falha fechado — nunca é coagido pra string", async () => {
  assert.throws(() => validateCursosPushInput({ ...validInput, title: 123 }), { code: "VALIDATE_TITLE_REQUIRED" });
});

test("launchUrl ausente falha fechado com VALIDATE_LAUNCH_URL_REQUIRED — não chama fetch", async () => {
  let calls = 0;
  const { launchUrl, ...rest } = validInput;
  const result = await sendCursosPushCampaign(rest, {
    ...config,
    fetchImpl: async () => { calls += 1; return okResponse(); },
  });
  assert.deepEqual(result, { kind: "error", code: "VALIDATE_LAUNCH_URL_REQUIRED", sentAt: null, data: null });
  assert.equal(calls, 0);
});

test("launchUrl malformada (sem protocolo, não começa com /) falha fechado", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, launchUrl: "nao-e-uma-url" }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_LAUNCH_URL_INVALID");
});

test("imageUrl com esquema não-http (ex.: javascript:) falha fechado", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, imageUrl: "javascript:alert(1)" }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_IMAGE_URL_INVALID");
});

test("botão sem texto falha fechado com VALIDATE_BUTTON_TEXT_REQUIRED", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, buttons: [{ text: "", url: "/x" }] }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_BUTTON_TEXT_REQUIRED");
});

test("botão com URL inválida falha fechado com VALIDATE_BUTTON_URL_INVALID", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, buttons: [{ text: "Ver", url: "nao-e-url" }] }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_BUTTON_URL_INVALID");
});

test("scheduleTime fora do formato HH:MM falha fechado", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, scheduleTime: "8pm" }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_SCHEDULE_TIME_INVALID");
});

test("segment com array vazio falha fechado com VALIDATE_SEGMENT_INVALID", async () => {
  const result = await sendCursosPushCampaign({ ...validInput, segment: [] }, config);
  assert.equal(result.kind, "error");
  assert.equal(result.code, "VALIDATE_SEGMENT_INVALID");
});

// --- 401 ---

test("401 do endpoint vira SEND_UNAUTHORIZED", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(JSON.stringify({ error: "Nao autorizado." }), { status: 401 })),
  });
  assert.deepEqual(result, { kind: "error", code: "SEND_UNAUTHORIZED", sentAt: null, data: null });
});

test("403 do endpoint também vira SEND_UNAUTHORIZED", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(null, { status: 403 })),
  });
  assert.equal(result.code, "SEND_UNAUTHORIZED");
});

// --- timeout ---

test("timeout (AbortError) vira SEND_TIMEOUT", async () => {
  const result = await sendCursosPushCampaign(validInput, {
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
  assert.deepEqual(result, { kind: "error", code: "SEND_TIMEOUT", sentAt: null, data: null });
});

// --- env ausente já coberto acima; host fora do allowlist ---

test("origin fora do allowlist (http em vez de https) falha fechado com BASE_URL_INVALID", async () => {
  const result = await sendCursosPushCampaign(validInput, { ...config, origin: "http://cursos.example.test" });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "BASE_URL_INVALID");
});

test("origin com credenciais embutidas falha fechado com BASE_URL_INVALID", async () => {
  const result = await sendCursosPushCampaign(validInput, { ...config, origin: "https://user:pass@cursos.example.test" });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "BASE_URL_INVALID");
});

// --- redirect nunca seguido ---

test("redirect não é seguido — 3xx vira erro tipado, nunca segue Location", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test/" } })),
  });
  assert.deepEqual(result, { kind: "error", code: "SEND_UNEXPECTED_REDIRECT", sentAt: null, data: null });
});

// --- resposta malformada: nenhum campo tem fallback silencioso ---

test("resposta sem 'id' falha fechado com RESPONSE_SCHEMA_INVALID — nunca vira sucesso com id undefined", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => okResponse({ ok: true, recipients: 5 })),
  });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_SCHEMA_INVALID", sentAt: null, data: null });
});

test("resposta com ok:false (mesmo com id presente) falha fechado", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => okResponse({ ok: false, id: "x", recipients: 1 })),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

test("resposta com recipients de tipo errado falha fechado — não vira null silencioso", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => okResponse({ ok: true, id: "x", recipients: "quarenta e dois" })),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "RESPONSE_SCHEMA_INVALID");
});

test("JSON inválido no corpo da resposta vira RESPONSE_JSON_INVALID, não quebra", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response("{not json", { status: 200 })),
  });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_JSON_INVALID", sentAt: null, data: null });
});

test("falha de rede (fetch rejeita) vira SEND_NETWORK_ERROR", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: async () => { throw new Error("ECONNRESET"); },
  });
  assert.deepEqual(result, { kind: "error", code: "SEND_NETWORK_ERROR", sentAt: null, data: null });
});

test("erro >=500 do endpoint vira SEND_UPSTREAM_ERROR", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 502 })),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "SEND_UPSTREAM_ERROR");
});

test("erro 400 do endpoint vira SEND_REQUEST_INVALID", async () => {
  const result = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(JSON.stringify({ error: "bad" }), { status: 400 })),
  });
  assert.equal(result.kind, "error");
  assert.equal(result.code, "SEND_REQUEST_INVALID");
});

// --- etapas distinguíveis (VALIDATE vs SEND vs RESPONSE) ---

test("erro de VALIDAÇÃO (local) e erro de ENVIO (rede) são distinguíveis e a validação nunca chama fetch", async () => {
  let calls = 0;
  const validationFailure = await sendCursosPushCampaign({ ...validInput, title: "" }, {
    ...config,
    fetchImpl: async () => { calls += 1; return okResponse(); },
  });
  const sendFailure = await sendCursosPushCampaign(validInput, {
    ...config,
    fetchImpl: stubFetch(async () => new Response(null, { status: 401 })),
  });

  assert.match(validationFailure.code, /^VALIDATE_/);
  assert.match(sendFailure.code, /^SEND_/);
  assert.notEqual(validationFailure.code, sendFailure.code);
  assert.equal(calls, 0, "falha de validação local nunca deve gerar chamada de rede");
});
