import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PROVISION_REQUEST_BYTES,
  QUIZ_DASHBOARD_PROJECTS_PATH,
  proxyQuizDashboardProjects,
  readBoundedJsonRequest,
} from "../src/lib/sistemas/quiz/funnel-proxy-core.mjs";

const ORIGIN = "https://quiz.example.test";
const CONFIG = { origin: ORIGIN, hostAllowlist: ["quiz.example.test"], username: "dashboard", password: "secret" };

function json(body, init = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

const safeSummary = {
  project_id: "round-popcorn",
  name: "Round Popcorn",
  funnel_id: "principal",
  offer_id: "ngv:round-popcorn",
  banco_offer_tracking_id: null,
  test_pilot: true,
  state: "receiving_events",
  final_url: "https://round-popcorn.example.test/vsl",
  origin: "https://round-popcorn.example.test",
  deployed_at: null,
  first_event_at: null,
};

function safeDetail() {
  return {
    ok: true,
    project: {
      project_id: "round-popcorn",
      name: "Round Popcorn",
      funnel_id: "principal",
      offer_id: "ngv:round-popcorn",
      banco_offer_tracking_id: null,
      test_pilot: true,
      public_key: "pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      state: "awaiting_deploy",
      final_url: "https://round-popcorn.example.test/vsl",
      allowed_origins: ["https://round-popcorn.example.test"],
      page_id: "presell-presell-1",
      format: "presell",
    },
    installation: {
      tracker_url: `${ORIGIN}/assets/tracker.js`,
      track_url: `${ORIGIN}/api/track`,
      pages: [
        {
          label: "Presell",
          url: "https://round-popcorn.example.test/",
          role: "presell",
          page_id: "presell-presell-1",
          snippet: `<script src="${ORIGIN}/assets/tracker.js" data-nga-page-id="presell-presell-1"></script>`,
        },
      ],
    },
  };
}

test("credenciais ausentes falham antes da rede", async () => {
  let calls = 0;
  const result = await proxyQuizDashboardProjects({ method: "GET" }, {
    ...CONFIG,
    username: "",
    fetchImpl: async () => { calls += 1; return json({}); },
  });
  assert.deepEqual(result, { ok: false, code: "MISSING_CREDENTIALS" });
  assert.equal(calls, 0);
});

test("lista usa Basic server-side, HTTPS allowlisted, redirect manual e devolve só seletor seguro", async () => {
  let captured;
  const result = await proxyQuizDashboardProjects({ method: "GET" }, {
    ...CONFIG,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return json({ ok: true, provisioning_enabled: true, projects: [safeSummary] });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(captured.url.origin, ORIGIN);
  assert.equal(captured.url.pathname, QUIZ_DASHBOARD_PROJECTS_PATH);
  assert.equal(captured.init.redirect, "manual");
  assert.equal(captured.init.headers.authorization, `Basic ${Buffer.from("dashboard:secret").toString("base64")}`);
  assert.equal(result.data.projects[0].project_id, "round-popcorn");
  assert.equal(result.data.projects[0].public_key, undefined);
});

test("criação fixa schema_version e constrói snippet canônico por página", async () => {
  let upstreamBody;
  const result = await proxyQuizDashboardProjects({
    method: "POST",
    payload: {
      name: "Round Popcorn",
      format: "presell",
      pages: [
        { url: "https://round-popcorn.example.test/" },
        { url: "https://round-popcorn.example.test/vsl" },
      ],
    },
  }, {
    ...CONFIG,
    fetchImpl: async (_url, init) => {
      upstreamBody = JSON.parse(init.body);
      const detail = safeDetail();
      detail.installation.pages[0].snippet = '<script src="https://evil.example.test/tracker.js" onload="steal()">malicious()</script>';
      return json(detail);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(upstreamBody.schema_version, 2);
  assert.equal(upstreamBody.name, "Round Popcorn");
  assert.equal(upstreamBody.project_id, undefined, "criação V2 não recebe ID técnico manual");
  assert.equal(upstreamBody.final_url, undefined, "criação V2 deriva a página final a partir do caminho");
  assert.deepEqual(upstreamBody.pages, [
    { label: "Presell", url: "https://round-popcorn.example.test/" },
    { label: "VSL", url: "https://round-popcorn.example.test/vsl" },
  ]);
  assert.equal(result.data.installation.pages[0].page_id, "presell-presell-1");
  assert.match(result.data.installation.pages[0].snippet, /data-nga-page-id="presell-presell-1"/);
  assert.match(result.data.installation.pages[0].snippet, new RegExp(`${ORIGIN}/assets/tracker\\.js`));
  assert.match(result.data.installation.pages[0].snippet, /data-nga-public-key="pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
  assert.doesNotMatch(result.data.installation.pages[0].snippet, /evil|onload|malicious/);
});

test("confirmação PATCH só encaminha projeto e URL final registrados, em schema próprio", async () => {
  let captured;
  const result = await proxyQuizDashboardProjects({
    method: "PATCH",
    payload: {
      projectId: "round-popcorn",
      finalUrl: "https://round-popcorn.example.test/vsl",
    },
  }, {
    ...CONFIG,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return json({
        ok: true,
        project: {
          project_id: "round-popcorn",
          state: "installed",
          final_url: "https://round-popcorn.example.test/vsl",
          deployed_at: "2026-09-12T08:00:00.000Z",
        },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(captured.url.pathname, QUIZ_DASHBOARD_PROJECTS_PATH);
  assert.equal(captured.init.method, "PATCH");
  assert.equal(captured.init.headers.authorization, `Basic ${Buffer.from("dashboard:secret").toString("base64")}`);
  assert.equal(captured.init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(captured.init.body), {
    schema_version: 1,
    project_id: "round-popcorn",
    final_url: "https://round-popcorn.example.test/vsl",
  });
  assert.deepEqual(result.data, {
    project: {
      project_id: "round-popcorn",
      state: "installed",
      final_url: "https://round-popcorn.example.test/vsl",
      deployed_at: "2026-09-12T08:00:00.000Z",
    },
  });
  assert.equal(result.data.project.public_key, undefined, "a resposta de confirmação não amplia o contrato com segredo de instalação");
});

test("confirmação PATCH falha fechada para payload inválido, conflito upstream e readback divergente", async () => {
  let calls = 0;
  const invalid = await proxyQuizDashboardProjects({
    method: "PATCH",
    payload: { projectId: "round-popcorn", finalUrl: "http://round-popcorn.example.test/vsl" },
  }, {
    ...CONFIG,
    fetchImpl: async () => { calls += 1; return json({}); },
  });
  assert.deepEqual(invalid, { ok: false, code: "REQUEST_INVALID" });
  assert.equal(calls, 0, "payload inválido não chama o upstream");

  const conflict = await proxyQuizDashboardProjects({
    method: "PATCH",
    payload: { projectId: "round-popcorn", finalUrl: "https://round-popcorn.example.test/vsl" },
  }, {
    ...CONFIG,
    fetchImpl: async () => new Response(JSON.stringify({ ok: false }), { status: 409 }),
  });
  assert.deepEqual(conflict, { ok: false, code: "UPSTREAM_CONFLICT" });

  const mismatch = await proxyQuizDashboardProjects({
    method: "PATCH",
    payload: { projectId: "round-popcorn", finalUrl: "https://round-popcorn.example.test/vsl" },
  }, {
    ...CONFIG,
    fetchImpl: async () => json({
      ok: true,
      project: {
        project_id: "round-popcorn",
        state: "installed",
        final_url: "https://other.example.test/vsl",
        deployed_at: null,
      },
    }),
  });
  assert.deepEqual(mismatch, { ok: false, code: "RESPONSE_FILTER_MISMATCH" });
});

test("quiz com três URLs gera e preserva um trecho canônico para cada página", async () => {
  let upstreamBody;
  const result = await proxyQuizDashboardProjects({
    method: "POST",
    payload: {
      name: "Quiz em etapas",
      format: "quiz",
      pages: [
        { url: "https://quiz.example.test/etapa-1" },
        { url: "https://quiz.example.test/etapa-2" },
        { url: "https://vsl.example.test/" },
      ],
    },
  }, {
    ...CONFIG,
    fetchImpl: async (_url, init) => {
      upstreamBody = JSON.parse(init.body);
      const detail = safeDetail();
      detail.project.format = "quiz";
      detail.project.page_id = "quiz-1";
      detail.project.final_url = "https://vsl.example.test/";
      detail.project.allowed_origins = ["https://quiz.example.test", "https://vsl.example.test"];
      detail.installation.pages = [
        { label: "Quiz — etapa 1", url: "https://quiz.example.test/etapa-1", role: "quiz", page_id: "quiz-1", snippet: "ignored" },
        { label: "Quiz — etapa 2", url: "https://quiz.example.test/etapa-2", role: "quiz", page_id: "quiz-2", snippet: "ignored" },
        { label: "VSL", url: "https://vsl.example.test/", role: "vsl", page_id: "vsl", snippet: "ignored" },
      ];
      return json(detail);
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(upstreamBody.pages, [
    { label: "Quiz", url: "https://quiz.example.test/etapa-1" },
    { label: "Quiz etapa 2", url: "https://quiz.example.test/etapa-2" },
    { label: "VSL", url: "https://vsl.example.test/" },
  ]);
  assert.deepEqual(result.data.installation.pages.map((page) => page.page_id), ["quiz-1", "quiz-2", "vsl"]);
  for (const page of result.data.installation.pages) {
    assert.match(page.snippet, new RegExp(`data-nga-page-id="${page.page_id}"`));
    assert.match(page.snippet, /data-nga-public-key="pk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
  }
});

test("detalhe V2 com duas páginas no mesmo origin reconstrói URLs de tracker canônicos", async () => {
  const upstreamAlias = "https://analytics-alias.example.test";
  const maliciousHost = "https://evil.example.test";
  const result = await proxyQuizDashboardProjects({ method: "POST", payload: {
    name: "Presell com VSL",
    format: "presell",
    pages: [
      { url: "https://round-popcorn.example.test/presell" },
      { url: "https://round-popcorn.example.test/vsl" },
    ],
  } }, {
    ...CONFIG,
    fetchImpl: async () => {
      const detail = safeDetail();
      detail.installation.tracker_url = `${upstreamAlias}/assets/tracker.js`;
      detail.installation.track_url = `${maliciousHost}/api/track`;
      detail.installation.pages = [
        {
          label: "Presell",
          url: "https://round-popcorn.example.test/presell",
          role: "presell",
          page_id: "presell",
          snippet: `<script src="${upstreamAlias}/assets/tracker.js"></script>`,
        },
        {
          label: "VSL",
          url: "https://round-popcorn.example.test/vsl",
          role: "vsl",
          page_id: "vsl",
          snippet: `<script src="${maliciousHost}/api/track"></script>`,
        },
      ];
      return json(detail);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.installation.tracker_url, `${ORIGIN}/assets/tracker.js`);
  assert.equal(result.data.installation.track_url, `${ORIGIN}/api/track`);
  assert.equal(result.data.installation.pages.length, 2);
  for (const page of result.data.installation.pages) {
    assert.match(page.snippet, new RegExp(`src="${ORIGIN}/assets/tracker\\.js"`));
    assert.match(page.snippet, new RegExp(`data-nga-endpoint="${ORIGIN}/api/track"`));
    assert.doesNotMatch(page.snippet, /analytics-alias|evil/);
  }
});

test("páginas de instalação inválidas continuam falhando fechadas", async () => {
  for (const invalidPage of [
    { label: "Presell", url: "http://round-popcorn.example.test/", role: "presell", page_id: "presell" },
    { label: "Presell", url: "https://round-popcorn.example.test/", role: "checkout", page_id: "presell" },
    { label: "Presell", url: "https://round-popcorn.example.test/", role: "presell", page_id: "invalid page id" },
  ]) {
    const result = await proxyQuizDashboardProjects({ method: "POST", payload: {
      name: "Round Popcorn",
      format: "presell",
      pages: [
        { url: "https://round-popcorn.example.test/" },
        { url: "https://round-popcorn.example.test/vsl" },
      ],
    } }, {
      ...CONFIG,
      fetchImpl: async () => {
        const detail = safeDetail();
        detail.installation.pages = [invalidPage];
        return json(detail);
      },
    });
    assert.deepEqual(result, { ok: false, code: "RESPONSE_SCHEMA_INVALID" });
  }
});

test("corpo declarado ou transmitido acima do limite é rejeitado antes do JSON.parse", async () => {
  const declared = new Request("https://banco.example.test/api/sistemas/quiz/funis", {
    method: "POST",
    headers: { "content-length": String(MAX_PROVISION_REQUEST_BYTES + 1) },
    body: "{}",
  });
  assert.deepEqual(await readBoundedJsonRequest(declared), { kind: "too_large" });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(MAX_PROVISION_REQUEST_BYTES + 1)));
      controller.close();
    },
  });
  const chunked = new Request("https://banco.example.test/api/sistemas/quiz/funis", {
    method: "POST",
    body: stream,
    duplex: "half",
  });
  assert.deepEqual(await readBoundedJsonRequest(chunked), { kind: "too_large" });
});

test("redirect, schema inválido e host fora da allowlist falham fechados", async () => {
  const redirect = await proxyQuizDashboardProjects({ method: "GET" }, {
    ...CONFIG,
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test" } }),
  });
  assert.deepEqual(redirect, { ok: false, code: "UNEXPECTED_REDIRECT" });

  const malformed = await proxyQuizDashboardProjects({ method: "GET" }, {
    ...CONFIG,
    fetchImpl: async () => json({ ok: true, provisioning_enabled: true, projects: [{ ...safeSummary, project_id: "NOT A SLUG" }] }),
  });
  assert.deepEqual(malformed, { ok: false, code: "RESPONSE_SCHEMA_INVALID" });

  const insecure = await proxyQuizDashboardProjects({ method: "GET" }, {
    ...CONFIG,
    origin: "https://elsewhere.example.test",
    fetchImpl: async () => json({ ok: true, provisioning_enabled: true, projects: [] }),
  });
  assert.deepEqual(insecure, { ok: false, code: "BASE_URL_INVALID" });
});
