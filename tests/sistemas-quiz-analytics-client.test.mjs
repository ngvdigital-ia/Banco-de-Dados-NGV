import assert from "node:assert/strict";
import test from "node:test";
import {
  QUIZ_ANALYTICS_PATH,
  fetchQuizModuleAnalytics,
  parseQuizModuleAnalyticsPayload,
} from "../src/lib/sistemas/quiz/analytics-client.mjs";

const config = { origin: "https://quiz.example.test", username: "user", password: "pass" };

const validBody = {
  generated_at: "2026-08-16T12:00:00.000Z",
  filter: { from: null, to: null, project_id: "p-1", funnel_id: "f-1" },
  summary: { total_sessions: 100, started: 80, checkout_clicks: 12, checkout_rate: 15 },
  funnel: [
    { id: "intro", label: "Intro", count: 100, overall_rate: 100, prev_pass_rate: 100, prev_drop_rate: 0, prev_drop_count: 0 },
    { id: "goal", label: "Goal", count: 80, overall_rate: 80, prev_pass_rate: 80, prev_drop_rate: 20, prev_drop_count: 20 },
  ],
  responses: [
    {
      id: "goal",
      label: "Qual seu objetivo?",
      stage_number: 2,
      stage_label: "Goal",
      multi: false,
      total_sessions: 80,
      answers: [{ label: "Emagrecer", count: 60, pct: 75 }],
    },
  ],
  utm_campaigns: [{ campaign: "black-friday", sessions: 40 }],
  recent_events: [
    { event_name: "screen_view", screen_id: "intro", label: null, created_at: "2026-08-16T11:59:00.000Z", session_short: "abcd1234", value: null },
  ],
  journeys: {
    summary: { total_journeys: 10, cross_page_journeys: 3 },
    pages: [{ page_id: "quiz", count: 10 }],
  },
};

function response(body, init = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("env ausente (credenciais) devolve not_configured e NUNCA chama fetch", async () => {
  let calls = 0;
  const result = await fetchQuizModuleAnalytics(
    {},
    { origin: config.origin, username: "", password: "", fetchImpl: async () => { calls += 1; return response(validBody); } },
  );
  assert.deepEqual(result, { kind: "not_configured", reason: "MISSING_CREDENTIALS", generatedAt: null, data: null });
  assert.equal(calls, 0, "credencial ausente não pode gerar rede real");
});

test("payload válido: GET com Basic Auth, redirect manual, path correto, e resultado validado campo a campo", async () => {
  let captured;
  const result = await fetchQuizModuleAnalytics(
    { projectId: "p-1", funnelId: "f-1", from: "2026-08-01T00:00:00.000Z", to: "2026-08-16T00:00:00.000Z" },
    { ...config, fetchImpl: async (url, init) => { captured = { url, init }; return response(validBody); } },
  );

  assert.equal(result.kind, "success");
  assert.equal(captured.url.origin, config.origin);
  assert.equal(captured.url.pathname, QUIZ_ANALYTICS_PATH);
  assert.equal(captured.url.searchParams.get("project_id"), "p-1");
  assert.equal(captured.url.searchParams.get("funnel_id"), "f-1");
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.redirect, "manual");
  assert.equal(captured.init.headers.authorization, `Basic ${Buffer.from("user:pass").toString("base64")}`);

  assert.equal(result.data.summary.totalSessions, 100);
  assert.equal(result.data.funnel[1].prevDropCount, 20);
  assert.equal(result.data.responses[0].answers[0].pct, 75);
  assert.equal(result.data.recentEvents[0].sessionShort, "abcd1234");
  assert.equal(result.data.journeys.summary.crossPageJourneys, 3);
});

test("payload malformado (campo com tipo errado) falha fechado com RESPONSE_SCHEMA_INVALID", async () => {
  assert.throws(
    () => parseQuizModuleAnalyticsPayload({ ...validBody, summary: { ...validBody.summary, total_sessions: "100" } }),
    { code: "RESPONSE_SCHEMA_INVALID" },
  );
  assert.throws(() => parseQuizModuleAnalyticsPayload({ ...validBody, funnel: "not-an-array" }), { code: "RESPONSE_SCHEMA_INVALID" });
  assert.throws(() => parseQuizModuleAnalyticsPayload({ ...validBody, generated_at: "not-a-date" }), { code: "RESPONSE_SCHEMA_INVALID" });

  const result = await fetchQuizModuleAnalytics(
    {},
    { ...config, fetchImpl: async () => response({ ...validBody, summary: null }) },
  );
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_SCHEMA_INVALID", generatedAt: null, data: null });
});

test("resposta 401 do Quiz vira erro tipado UNAUTHORIZED — nunca dado zero", async () => {
  const result = await fetchQuizModuleAnalytics(
    {},
    { ...config, fetchImpl: async () => new Response(JSON.stringify({ ok: false }), { status: 401 }) },
  );
  assert.deepEqual(result, { kind: "error", code: "UNAUTHORIZED", generatedAt: null, data: null });
});

test("timeout (AbortError) vira erro tipado TIMEOUT", async () => {
  const result = await fetchQuizModuleAnalytics(
    {},
    {
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
    },
  );
  assert.deepEqual(result, { kind: "error", code: "TIMEOUT", generatedAt: null, data: null });
});

test("redirect não é seguido — 3xx vira erro tipado, nunca segue Location", async () => {
  const result = await fetchQuizModuleAnalytics(
    {},
    { ...config, fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test/" } }) },
  );
  assert.deepEqual(result, { kind: "error", code: "UNEXPECTED_REDIRECT", generatedAt: null, data: null });
});

test("JSON inválido no corpo vira erro tipado, não quebra", async () => {
  const result = await fetchQuizModuleAnalytics({}, { ...config, fetchImpl: async () => response("{not json") });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_JSON_INVALID", generatedAt: null, data: null });
});

test("falha de rede (fetch rejeita) vira erro tipado NETWORK_ERROR", async () => {
  const result = await fetchQuizModuleAnalytics({}, { ...config, fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  assert.deepEqual(result, { kind: "error", code: "NETWORK_ERROR", generatedAt: null, data: null });
});

test("host fora do allowlist (origin http, ou host trocado) falha fechado", async () => {
  const insecure = await fetchQuizModuleAnalytics({}, { ...config, origin: "http://quiz.example.test", fetchImpl: async () => response(validBody) });
  assert.equal(insecure.kind, "error");
  assert.equal(insecure.code, "BASE_URL_INVALID");
});
