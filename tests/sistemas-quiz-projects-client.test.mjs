import assert from "node:assert/strict";
import test from "node:test";
import {
  QUIZ_DASHBOARD_PROJECTS_PATH,
  deriveQuizProvisionPayload,
  fetchQuizDashboardProjects,
  provisionQuizDashboardProject,
} from "../src/lib/sistemas/quiz/projects-client.mjs";

const credentials = { username: "dashboard-user", password: "dashboard-password" };

const listPayload = {
  ok: true,
  provisioning_enabled: true,
  projects: [{
    project_id: "gelatina-bariatrica",
    name: "Gelatina Bariátrica",
    funnel_id: "principal",
    offer_id: "ngv:gelatina-bariatrica",
    banco_offer_tracking_id: 83,
    test_pilot: false,
    state: "installed",
    final_url: "https://gelatina.example.test/vsl",
    origin: "https://gelatina.example.test",
    deployed_at: "2026-09-01T12:00:00.000Z",
    first_event_at: null,
    // O endpoint de lista não deveria enviar isso; o adapter deve descartá-lo
    // mesmo se um deploy futuro errar a projeção.
    public_key: "pk_must_not_leave_the_server_list",
  }],
};

const provisionPayload = {
  ok: true,
  project: {
    project_id: "gelatina-bariatrica",
    name: "Gelatina Bariátrica",
    funnel_id: "principal",
    offer_id: "ngv:gelatina-bariatrica",
    banco_offer_tracking_id: 83,
    test_pilot: false,
    public_key: "pk_abcdefghijklmnopqrstuvwx",
    public_key_prefix: "pk_abcdefghij",
    state: "awaiting_deploy",
    final_url: "https://gelatina.example.test/vsl",
    allowed_origins: ["https://gelatina.example.test"],
    page_id: "pagina-inicial",
    steps: [{ id: "pagina-inicial", label: "Página inicial", index: 0 }],
  },
  installation: {
    type: "ngv.analytics.tracker",
    version: 1,
    tracker_url: "https://quiz-analytics-phi.vercel.app/assets/tracker.js",
    track_url: "https://quiz-analytics-phi.vercel.app/api/track",
    attributes: {
      "data-nga-project-id": "gelatina-bariatrica",
      "data-nga-funnel-id": "principal",
      "data-nga-page-id": "pagina-inicial",
      "data-nga-endpoint": "https://quiz-analytics-phi.vercel.app/api/track",
      "data-nga-public-key": "pk_abcdefghijklmnopqrstuvwx",
    },
  },
};

function response(body, init = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("credenciais ausentes: não configura e nunca chama rede", async () => {
  let calls = 0;
  const result = await fetchQuizDashboardProjects({
    username: "",
    password: "",
    fetchImpl: async () => { calls += 1; return response(listPayload); },
  });
  assert.deepEqual(result, { kind: "not_configured", reason: "MISSING_CREDENTIALS", receivedAt: null, data: null });
  assert.equal(calls, 0);
});

test("listagem faz GET Basic server-side, bloqueia redirect e não expõe public key", async () => {
  let captured;
  const result = await fetchQuizDashboardProjects({
    ...credentials,
    fetchImpl: async (url, init) => { captured = { url, init }; return response(listPayload); },
  });
  assert.equal(result.kind, "success");
  assert.equal(captured.url.origin, "https://quiz-analytics-phi.vercel.app");
  assert.equal(captured.url.pathname, QUIZ_DASHBOARD_PROJECTS_PATH);
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.redirect, "manual");
  assert.equal(captured.init.headers.authorization, `Basic ${Buffer.from("dashboard-user:dashboard-password").toString("base64")}`);
  assert.doesNotMatch(JSON.stringify(result), /dashboard-password|public_key|pk_must_not/);
  assert.equal(result.data.projects[0].projectId, "gelatina-bariatrica");
});

test("401 e 403 nunca viram lista vazia", async () => {
  for (const status of [401, 403]) {
    const result = await fetchQuizDashboardProjects({ ...credentials, fetchImpl: async () => response({ ok: false }, { status }) });
    assert.deepEqual(result, { kind: "error", code: "UNAUTHORIZED", receivedAt: null, data: null });
  }
});

test("redirect e resposta oversized falham fechado", async () => {
  const redirected = await fetchQuizDashboardProjects({
    ...credentials,
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://other.example.test" } }),
  });
  assert.equal(redirected.code, "UNEXPECTED_REDIRECT");

  const oversized = await fetchQuizDashboardProjects({
    ...credentials,
    fetchImpl: async () => response("x".repeat(128 * 1024 + 1)),
  });
  assert.equal(oversized.code, "RESPONSE_TOO_LARGE");
});

test("schema inválido de listagem falha fechado", async () => {
  const result = await fetchQuizDashboardProjects({
    ...credentials,
    fetchImpl: async () => response({ ...listPayload, projects: [{ ...listPayload.projects[0], test_pilot: true }] }),
  });
  assert.deepEqual(result, { kind: "error", code: "RESPONSE_SCHEMA_INVALID", receivedAt: null, data: null });
});

test("provisionamento deriva IDs no adapter, não persiste formato e valida retorno autorizado", async () => {
  let captured;
  const result = await provisionQuizDashboardProject({
    name: "Gelatina Bariátrica",
    finalUrl: "https://gelatina.example.test/vsl",
    format: "quiz",
    bancoOfferTrackingId: 83,
  }, {
    ...credentials,
    fetchImpl: async (url, init) => { captured = { url, init }; return response(provisionPayload); },
  });
  assert.equal(result.kind, "success");
  assert.equal(captured.url.pathname, QUIZ_DASHBOARD_PROJECTS_PATH);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["content-type"], "application/json");
  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body, {
    schema_version: 1,
    name: "Gelatina Bariátrica",
    slug: "gelatina-bariatrica",
    funnel_id: "principal",
    offer_id: "ngv:gelatina-bariatrica",
    banco_offer_tracking_id: 83,
    final_url: "https://gelatina.example.test/vsl",
    page_id: "pagina-inicial",
    steps: [{ id: "pagina-inicial", label: "Página inicial", index: 0 }],
  });
  assert.equal(body.format, undefined, "formato é apenas orientação da sessão");
  assert.equal(result.data.project.publicKey, "pk_abcdefghijklmnopqrstuvwx", "retorno autorizado necessário ao tracker");
  assert.doesNotMatch(JSON.stringify(result), /dashboard-password/);
});

test("vínculo Banco opcional usa o contrato test_pilot e input inválido não faz POST", async () => {
  assert.deepEqual(deriveQuizProvisionPayload({
    name: "Piloto",
    finalUrl: "https://pilot.example.test",
    format: "vsl",
  }), {
    schema_version: 1,
    name: "Piloto",
    slug: "piloto",
    funnel_id: "principal",
    offer_id: "ngv:piloto",
    banco_offer_tracking_id: null,
    test_pilot: true,
    final_url: "https://pilot.example.test",
    page_id: "pagina-inicial",
    steps: [{ id: "pagina-inicial", label: "Página inicial", index: 0 }],
  });

  let calls = 0;
  const result = await provisionQuizDashboardProject({ name: " ", finalUrl: "http://not-https.example.test" }, {
    ...credentials,
    fetchImpl: async () => { calls += 1; return response(provisionPayload); },
  });
  assert.equal(result.code, "PROVISION_INPUT_INVALID");
  assert.equal(calls, 0);
});

test("conflito e corpo de erro upstream não são refletidos ao operador", async () => {
  const result = await provisionQuizDashboardProject({
    name: "Gelatina Bariátrica",
    finalUrl: "https://gelatina.example.test/vsl",
    bancoOfferTrackingId: 83,
  }, {
    ...credentials,
    fetchImpl: async () => response({ error: "dashboard-password must never leave here" }, { status: 409 }),
  });
  assert.deepEqual(result, { kind: "error", code: "CONFLICT", receivedAt: null, data: null });
  assert.doesNotMatch(JSON.stringify(result), /password/);
});

test("instalação só aceita URLs canônicas do origin Quiz; host, query e attrs arbitrários são rejeitados", async () => {
  const maliciousUrls = [
    { tracker_url: "https://evil.example.test/assets/tracker.js" },
    { tracker_url: "https://quiz-analytics-phi.vercel.app/assets/tracker.js?redirect=https://evil.example.test" },
    { track_url: "https://evil.example.test/api/track" },
    { track_url: "https://quiz-analytics-phi.vercel.app/api/track#fragment" },
    { attributes: { ...provisionPayload.installation.attributes, "data-nga-endpoint": "https://evil.example.test/api/track" } },
  ];
  for (const patch of maliciousUrls) {
    const upstream = {
      ...provisionPayload,
      installation: {
        ...provisionPayload.installation,
        ...patch,
        attributes: patch.attributes ?? provisionPayload.installation.attributes,
      },
    };
    const result = await provisionQuizDashboardProject({
      name: "Gelatina Bariátrica",
      finalUrl: "https://gelatina.example.test/vsl",
      bancoOfferTrackingId: 83,
    }, { ...credentials, fetchImpl: async () => response(upstream) });
    assert.deepEqual(result, { kind: "error", code: "RESPONSE_SCHEMA_INVALID", receivedAt: null, data: null });
  }
});
