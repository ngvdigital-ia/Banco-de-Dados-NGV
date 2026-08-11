import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { collectLiveOperation, extractAllowedN8nTaskIds, refreshLiveStatus } from "../src/lib/operacao/refresh-live-status.mjs";
import { mergeLiveEvidence, projectLiveArtifact } from "../src/lib/operacao/generate-snapshot.mjs";

const NOW = Date.parse("2026-08-10T12:00:00.000Z");
const TASKS = ["86ajm207a", "86ajubm1t", "86ajxg4hn"];
const manifest = {
  offer_id: "ngv:calistenia-21d",
  offer_slug: "calistenia-21d",
  identity: { language: "es" },
  systems: {
    clickup: {
      parent_task_id: TASKS[0],
      task_variants: [
        { task_id: TASKS[1], relation: "locale_variant", locale: "en" },
        { task_id: TASKS[2], relation: "locale_variant", locale: "fr" },
      ],
    },
  },
};

const bumbumflixManifest = {
  offer_id: "ngv:bumbumflix",
  offer_slug: "bumbumflix",
  identity: { language: "en/fr" },
  systems: {
    clickup: {
      parent_task_id: "86ajtfhvh",
      operational_tasks: [
        { task_id: "86ajtfhwv", relation: "create_tracking", phase: 6 },
        { task_id: "86ajxg9ax", relation: "apply_tracking", phase: 6 },
      ],
    },
  },
};

const liveEnv = {
  CLICKUP_API_TOKEN: "test-clickup-token",
  N8N_BASE_URL: "https://n8n-production-d5ef.up.railway.app",
  N8N_API_KEY: "test-n8n-key",
  N8N_OPERATION_WORKFLOW_ID: "F8GWU4QxWg9hBAVQ",
};

async function readOptional(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

function response(value, status = 200, contentLength = null) {
  return {
    ok: status >= 200 && status < 300,
    headers: { get: (name) => name === "content-length" ? contentLength : null },
    json: async () => value,
  };
}

function runData(taskIds, node = "Normalizar evento") {
  const field = node === "Normalizar evento" || node === "Enriquecer task" ? "task_id" : "id";
  return {
    [node]: [{ data: { main: [[...taskIds.map((taskId) => ({ json: { [field]: taskId } }))]] } }],
  };
}

function liveFetch({ n8nStatus = 200, n8nData, clickupUpdatedAt = "2026-08-10T11:30:00.000Z" } = {}) {
  const calls = [];
  const options = [];
  const fetchImpl = async (url, requestOptions) => {
    const parsed = new URL(url);
    calls.push(parsed);
    options.push(requestOptions);
    if (parsed.hostname === "api.clickup.com") {
      const taskId = parsed.pathname.split("/").at(-1);
      return response({
        id: taskId,
        status: { status: "in progress" },
        date_updated: clickupUpdatedAt,
        description: "person@example.test must not persist",
        token: "do-not-persist",
      });
    }
    return response(n8nData ?? {
      data: [{
        id: "execution-17",
        status: "success",
        startedAt: "2026-08-10T11:20:00.000Z",
        stoppedAt: "2026-08-10T11:21:00.000Z",
        data: { resultData: { runData: runData([TASKS[1], "86ajubm1"]) } },
      }],
    }, n8nStatus);
  };
  return { calls, options, fetchImpl };
}

test("coleta somente referências exatas do manifesto e respeita os parâmetros n8n", async () => {
  const mock = liveFetch();
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });

  assert.deepEqual(artifact.clickup_tasks.map((item) => item.clickup_task_id).sort(), [...TASKS].sort());
  assert.deepEqual(artifact.clickup_tasks.map((item) => item.locale).sort(), ["en", "es", "fr"]);
  assert.deepEqual(artifact.n8n_executions.map((item) => item.clickup_task_id), [TASKS[1]]);
  assert.equal(artifact.n8n_executions[0].workflow_id, "F8GWU4QxWg9hBAVQ");
  assert.equal(artifact.n8n_executions[0].event, "n8n_execution_observed");
  assert.equal(artifact.n8n_executions[0].last_node, "Normalizar evento");
  assert.equal(mock.calls.filter((call) => call.hostname === "api.clickup.com").length, 3);
  const n8n = mock.calls.find((call) => call.hostname === "n8n-production-d5ef.up.railway.app");
  assert.equal(n8n.pathname, "/api/v1/executions");
  assert.equal(n8n.searchParams.get("workflowId"), "F8GWU4QxWg9hBAVQ");
  assert.equal(n8n.searchParams.get("limit"), "20");
  assert.equal(n8n.searchParams.get("includeData"), "true");
  assert.ok(mock.options.every((item) => item.redirect === "error"));
});

test("extrator n8n recusa ID não rastreado e nó fora da allowlist", () => {
  const allowed = new Set(TASKS);
  assert.deepEqual([...extractAllowedN8nTaskIds(runData(["86ajubm1", TASKS[2]]), allowed)], [TASKS[2]]);
  assert.deepEqual([...extractAllowedN8nTaskIds(runData([TASKS[0]], "Buscar tarefa atualizada"), allowed)], [TASKS[0]]);
  assert.deepEqual([...extractAllowedN8nTaskIds(runData([TASKS[1]], "Buscar tarefa-mãe"), allowed)], [TASKS[1]]);
  assert.deepEqual([...extractAllowedN8nTaskIds(runData([TASKS[0]], "Outro nó"), allowed)], []);
});

test("restringe referências e chamadas ao manifesto do piloto", async () => {
  const otherManifest = {
    ...manifest,
    offer_id: "ngv:outra-oferta",
    systems: { clickup: { parent_task_id: "outra123" } },
  };
  const mock = liveFetch();
  const artifact = await collectLiveOperation([manifest, otherManifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });

  assert.ok(artifact.clickup_tasks.every((item) => item.offer_id === "ngv:calistenia-21d"));
  assert.equal(mock.calls.filter((call) => call.hostname === "api.clickup.com").length, 3);
  assert.equal(mock.calls.some((call) => call.pathname.endsWith("outra123")), false);
});

test("allowlist do piloto lê pai, variante e operational_tasks dos dois pilotos", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    if (parsed.hostname === "api.clickup.com") {
      const taskId = parsed.pathname.split("/").at(-1);
      const status = taskId === "86ajtfhvh" ? "finalizado" : taskId === "86ajxg9ax" ? "briefing" : "concluído";
      return response({
        id: taskId,
        status: { status },
        date_updated: "2026-08-10T11:30:00.000Z",
        assignees: [{ username: "Diogo", email: "private@example.test" }],
      });
    }
    return response({ data: [] });
  };
  const artifact = await collectLiveOperation([manifest, bumbumflixManifest], { env: liveEnv, fetchImpl, now: NOW });
  const bumbumTasks = artifact.clickup_tasks.filter((item) => item.offer_id === "ngv:bumbumflix");

  assert.deepEqual(bumbumTasks.map((item) => item.clickup_task_id).sort(), ["86ajtfhvh", "86ajtfhwv", "86ajxg9ax"]);
  assert.equal(bumbumTasks.find((item) => item.clickup_task_id === "86ajxg9ax")?.relation, "apply_tracking");
  assert.equal(bumbumTasks.find((item) => item.clickup_task_id === "86ajxg9ax")?.phase, 6);
  assert.ok(bumbumTasks.every((item) => item.owner === "Diogo"));
  assert.equal(JSON.stringify(artifact).includes("private@example.test"), false);
  assert.equal(calls.filter((call) => call.hostname === "api.clickup.com").length, 6);
});

test("pai fechado não conclui oferta com tarefa aberta; aberta é movimento", () => {
  const generatedAt = "2026-08-10T12:00:00.000Z";
  const artifact = projectLiveArtifact({
    schema_version: 1,
    mode: "read-only",
    generated_at: generatedAt,
    sources: [{ id: "clickup", state: "OPERANT", coverage: "3/3", detail: "ok", last_read_at: generatedAt }],
    clickup_tasks: [
      { offer_id: "ngv:bumbumflix", clickup_task_id: "86ajtfhvh", relation: "parent_task", phase: 1, locale: "en/fr", owner: "PENDING", status: "finalizado", observed_at: generatedAt, updated_at: generatedAt },
      { offer_id: "ngv:bumbumflix", clickup_task_id: "86ajxg9ax", relation: "apply_tracking", phase: 6, locale: "PENDING", owner: "Diogo", status: "briefing", observed_at: generatedAt, updated_at: generatedAt },
    ],
    events: [],
  }, new Set(["ngv:bumbumflix"]));
  const merged = mergeLiveEvidence({
    offers: [{
      offer_id: "ngv:bumbumflix",
      state: "PENDING",
      aggregated_status: "PENDING",
      source_status: "PENDING",
      next_owner: "PENDING",
      blockers: [],
      evidence: [{ source: "clickup", external_id: "86ajtfhvh", relation: "parent_task", state: "PENDING", observed_at: null }],
      last_evidence_at: null,
    }],
    sources: [{ id: "clickup", state: "UNVERIFIED", coverage: "0/2", detail: "local", last_read_at: null }],
    events: [],
  }, artifact, Date.parse("2026-08-10T13:00:00.000Z"));
  const offer = merged.offers[0];

  assert.equal(offer.state, "IN_MOTION");
  assert.equal(offer.aggregated_status, "IN_MOTION");
  assert.equal(offer.phase, 6);
  assert.equal(offer.source_status, "finalizado");
  assert.equal(offer.next_owner, "Diogo");
  assert.equal(offer.evidence.filter((item) => item.external_id === "86ajtfhvh").length, 1);
  assert.ok(offer.evidence.some((item) => item.external_id === "86ajxg9ax" && item.state === "briefing"));
});

test("status aberto da variante FR mantém Calistenia em movimento", () => {
  const timestamp = "2026-08-10T12:00:00.000Z";
  const artifact = projectLiveArtifact({
    schema_version: 1,
    mode: "read-only",
    generated_at: timestamp,
    sources: [{ id: "clickup", state: "OPERANT", coverage: "3/3", detail: "ok", last_read_at: timestamp }],
    clickup_tasks: [
      { offer_id: "ngv:calistenia-21d", clickup_task_id: "86ajm207a", relation: "parent_task", status: "finalizado", observed_at: timestamp },
      { offer_id: "ngv:calistenia-21d", clickup_task_id: "86ajxg4hn", relation: "locale_variant", locale: "fr", status: "briefing", observed_at: timestamp },
    ],
    events: [],
  }, new Set(["ngv:calistenia-21d"]));
  const merged = mergeLiveEvidence({
    offers: [{ offer_id: "ngv:calistenia-21d", state: "READY_FOR_REVIEW", aggregated_status: "READY_FOR_REVIEW", source_status: "PENDING", next_owner: "PENDING", blockers: [], evidence: [], last_evidence_at: null }],
    sources: [{ id: "clickup", state: "UNVERIFIED", coverage: "0/3", detail: "local", last_read_at: null }],
    events: [],
  }, artifact);

  assert.equal(merged.offers[0].state, "IN_MOTION");
  assert.ok(merged.offers[0].evidence.some((item) => item.external_id === "86ajxg4hn"));
});

test("rejeita URL n8n fora da origem permitida antes da rede", async () => {
  for (const baseUrl of ["http://n8n-production-d5ef.up.railway.app", "https://n8n.test", "https://n8n-production-d5ef.up.railway.app/api"]) {
    let calls = 0;
    await assert.rejects(collectLiveOperation([manifest], {
      env: { ...liveEnv, N8N_BASE_URL: baseUrl },
      fetchImpl: async () => { calls += 1; throw new Error("não deveria chamar rede"); },
      now: NOW,
    }), /N8N_BASE_URL inválida/);
    assert.equal(calls, 0);
  }
});

test("artefato live não persiste payload bruto ou campos sensíveis", async () => {
  const mock = liveFetch();
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });
  const serialized = JSON.stringify(artifact);

  assert.equal(serialized.includes("person@example.test"), false);
  assert.equal(serialized.includes("do-not-persist"), false);
  assert.equal(serialized.includes("test-clickup-token"), false);
  assert.equal(serialized.includes("test-n8n-key"), false);
  assert.equal(Object.hasOwn(artifact.clickup_tasks[0], "description"), false);
});

test("sanitiza CPF, telefone, paths, JWT e chaves de status e last_node", async () => {
  const secretLikeValues = [
    ["sk", "private_value"].join("_"),
    ["sk", "proj-private_value"].join("-"),
  ];
  const sensitiveValues = [
    "123.456.789-09",
    "(11) 99999-9999",
    "/home/operator/private",
    "C:\\Users\\operator",
    "file:///home/operator/private",
    "(/home/operator/private)",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
    ...secretLikeValues,
    "pk_public_value",
    "pk-live-private_value",
  ];
  for (const value of sensitiveValues) {
    const mock = liveFetch({
      n8nData: {
        data: [{
          id: "execution-17",
          status: value,
          startedAt: "2026-08-10T11:20:00.000Z",
          data: { resultData: { lastNodeExecuted: value, runData: runData([TASKS[1]]) } },
        }],
      },
    });
    const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });
    const execution = artifact.n8n_executions[0];

    assert.equal(execution.status, "OBSERVED");
    assert.equal(execution.last_node, "Normalizar evento");
    assert.equal(JSON.stringify(artifact).includes(value), false);
  }
});

test("rejeita resposta declarada acima de 25 MiB sem parsear", async () => {
  const mock = liveFetch({ n8nData: { ignored: true } });
  const fetchImpl = async (url, options) => {
    if (new URL(url).hostname === "api.clickup.com") return mock.fetchImpl(url, options);
    return response({}, 200, String(26 * 1024 * 1024));
  };
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl, now: NOW });

  assert.equal(artifact.sources.find((item) => item.id === "n8n")?.state, "UNAVAILABLE");
});

test("rejeita resposta textual acima de 25 MiB antes do JSON.parse", async () => {
  const mock = liveFetch();
  const fetchImpl = async (url, options) => {
    if (new URL(url).hostname === "api.clickup.com") return mock.fetchImpl(url, options);
    return {
      ok: true,
      headers: { get: () => null },
      text: async () => "x".repeat(26 * 1024 * 1024),
    };
  };
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl, now: NOW });

  assert.equal(artifact.sources.find((item) => item.id === "n8n")?.state, "UNAVAILABLE");
});

test("normaliza date_updated ISO e epoch do ClickUp", async () => {
  const mock = liveFetch({ clickupUpdatedAt: 1786361400000 });
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });

  assert.equal(artifact.clickup_tasks[0].updated_at, "2026-08-10T11:30:00.000Z");
});

test("ausência de ambiente falha antes de chamar rede ou escrever o artefato", async () => {
  let calls = 0;
  const output = new URL("../src/lib/operacao/operation.live.json", import.meta.url);
  const before = await readOptional(output);
  await assert.rejects(refreshLiveStatus([manifest], {
    env: {},
    fetchImpl: async () => { calls += 1; throw new Error("não deveria chamar rede"); },
    now: NOW,
  }), /Ambiente obrigatório ausente/);

  assert.equal(calls, 0);
  assert.equal(await readOptional(output), before);
});

test("falha n8n não apaga a evidência ClickUp", async () => {
  const mock = liveFetch({ n8nStatus: 503 });
  const artifact = await collectLiveOperation([manifest], { env: liveEnv, fetchImpl: mock.fetchImpl, now: NOW });

  assert.equal(artifact.sources.find((source) => source.id === "clickup")?.state, "OPERANT");
  assert.equal(artifact.sources.find((source) => source.id === "n8n")?.state, "UNAVAILABLE");
  assert.equal(artifact.clickup_tasks.length, 3);
  assert.equal(artifact.n8n_executions.length, 0);
});
