import { readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_HUB = path.resolve(HERE, "../../../../..");
const LIVE_OUTPUT = path.join(HERE, "operation.live.json");
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const PILOT_OFFER_ID = "ngv:calistenia-21d";
const N8N_ORIGIN = "https://n8n-production-d5ef.up.railway.app";
const OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLICKUP_TASK_ID = /^[A-Za-z0-9]{1,80}$/;
const WORKFLOW_ID = /^[A-Za-z0-9]{1,80}$/;
const EXTERNAL_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const ALLOWED_N8N_TASK_NODES = new Set([
  "Normalizar evento",
  "Enriquecer task",
  "Buscar tarefa atualizada",
  "Buscar tarefa mãe",
  "Buscar tarefa-mãe",
]);
const SENSITIVE_VALUE = /(?:xox[baprs]-|ghp_|glpat-|bearer\s+[a-z0-9._~-]|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CPF_VALUE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PHONE_VALUE = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-])\d{4,5}[\s.-]\d{4}\b/;
const PATH_VALUE = /(?:[A-Za-z]:\\|file:\/\/\/(?:[A-Za-z0-9._-]+\/?)+|(?:^|[\s"'=(])\/(?:[A-Za-z0-9._-]+\/?)+)/;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const OPENAI_KEY_VALUE = /\b(?:sk|pk)_[A-Za-z0-9_-]+\b|\bsk-proj-[A-Za-z0-9_-]+\b|\bpk-[A-Za-z0-9_-]+\b/i;
const SENSITIVE_KEY = /^(?:email|e-mail|token|secret|password|cookie|authorization|api[_-]?key|access[_-]?key|private[_-]?key)$/i;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value, fallback = "PENDING", max = 180) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.trim().replace(/[\r\n\t]+/g, " ");
  if (isSensitiveText(normalized)) return fallback;
  return normalized.slice(0, max);
}

function isSensitiveText(value) {
  return SENSITIVE_VALUE.test(value) || EMAIL_VALUE.test(value) || CPF_VALUE.test(value)
    || PHONE_VALUE.test(value) || PATH_VALUE.test(value) || JWT_VALUE.test(value) || OPENAI_KEY_VALUE.test(value);
}

function assertSafeArtifact(value, trail = "artifact") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeArtifact(item, `${trail}[${index}]`));
    return;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`Artefato recusado: chave sensível em ${trail}.${key}.`);
      assertSafeArtifact(item, `${trail}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && isSensitiveText(value)) {
    throw new Error(`Artefato recusado: conteúdo sensível em ${trail}.`);
  }
}

function isoOrNull(value) {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : null;
  const timestamp = numericValue === null
    ? typeof value === "string" ? Date.parse(value) : Number.NaN
    : Math.abs(numericValue) < 100_000_000_000 ? numericValue * 1000 : numericValue;
  if (!Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) return null;
  return new Date(timestamp).toISOString();
}

function externalIdOrNull(value) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return EXTERNAL_ID.test(normalized) ? normalized : null;
}

function source(id, label, state, coverage, detail, lastReadAt = null) {
  return {
    id,
    label,
    state,
    coverage: safeText(coverage, "0/0", 40),
    detail: safeText(detail, "PENDING", 180),
    last_read_at: isoOrNull(lastReadAt),
  };
}

function clickupToken(env) {
  const token = typeof env?.CLICKUP_API_TOKEN === "string" ? env.CLICKUP_API_TOKEN.trim() : "";
  const apiKey = typeof env?.CLICKUP_API_KEY === "string" ? env.CLICKUP_API_KEY.trim() : "";
  return token || apiKey;
}

function requiredEnvironment(env) {
  const required = ["N8N_BASE_URL", "N8N_API_KEY", "N8N_OPERATION_WORKFLOW_ID"];
  const missing = required.filter((name) => typeof env?.[name] !== "string" || !env[name].trim());
  if (!clickupToken(env)) missing.unshift("CLICKUP_API_TOKEN ou CLICKUP_API_KEY");
  if (missing.length > 0) throw new Error(`Ambiente obrigatório ausente: ${missing.join(", ")}.`);

  let n8nBaseUrl;
  try {
    n8nBaseUrl = new URL(env.N8N_BASE_URL.trim());
  } catch {
    throw new Error("N8N_BASE_URL inválida.");
  }
  if (n8nBaseUrl.origin !== N8N_ORIGIN || n8nBaseUrl.pathname !== "/" || n8nBaseUrl.search || n8nBaseUrl.hash
    || n8nBaseUrl.username || n8nBaseUrl.password) {
    throw new Error("N8N_BASE_URL inválida.");
  }
  if (!WORKFLOW_ID.test(env.N8N_OPERATION_WORKFLOW_ID.trim())) throw new Error("N8N_OPERATION_WORKFLOW_ID inválido.");

  return {
    clickupToken: clickupToken(env),
    n8nBaseUrl,
    n8nApiKey: env.N8N_API_KEY.trim(),
    workflowId: env.N8N_OPERATION_WORKFLOW_ID.trim(),
  };
}

export function clickupTaskReferences(manifests) {
  const references = new Map();
  for (const manifest of manifests) {
    const offerId = isObject(manifest) && typeof manifest.offer_id === "string" ? manifest.offer_id.trim() : "";
    if (!OFFER_ID.test(offerId)) throw new Error("offer_id inválido no manifesto.");
    if (offerId !== PILOT_OFFER_ID) continue;
    const add = (taskId, relation, locale) => {
      if (typeof taskId !== "string" || !CLICKUP_TASK_ID.test(taskId)) throw new Error("task_id ClickUp inválido no manifesto.");
      if (references.has(taskId)) throw new Error(`task_id ClickUp duplicado no manifesto: ${taskId}.`);
      references.set(taskId, {
        offer_id: offerId,
        clickup_task_id: taskId,
        relation: safeText(relation, "parent_task", 40),
        locale: safeText(locale, "PENDING", 12),
      });
    };

    add(manifest.systems?.clickup?.parent_task_id, "parent_task", manifest.identity?.language);
    for (const variant of Array.isArray(manifest.systems?.clickup?.task_variants) ? manifest.systems.clickup.task_variants : []) {
      if (!isObject(variant)) throw new Error("task_variant ClickUp inválido no manifesto.");
      add(variant.task_id, variant.relation, variant.locale);
    }
  }
  return [...references.values()];
}

async function requestJson(fetchImpl, url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: "GET", headers, signal: controller.signal, redirect: "error" });
    if (!response?.ok) return null;
    return await responseJsonWithinLimit(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function responseJsonWithinLimit(response) {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_RESPONSE_BYTES)) return null;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  }
  if (typeof response.text === "function") {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) return null;
    return JSON.parse(text);
  }
  if (typeof response.json === "function") {
    const serialized = JSON.stringify(await response.json());
    if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) return null;
    return JSON.parse(serialized);
  }
  return null;
}

export function extractAllowedN8nTaskIds(runData, allowedTaskIds) {
  const matches = new Set();
  if (!isObject(runData)) return matches;
  for (const nodeName of ALLOWED_N8N_TASK_NODES) {
    const field = nodeName === "Normalizar evento" || nodeName === "Enriquecer task" ? "task_id" : "id";
    for (const run of Array.isArray(runData[nodeName]) ? runData[nodeName] : []) {
      for (const branch of Array.isArray(run?.data?.main) ? run.data.main : []) {
        for (const item of Array.isArray(branch) ? branch : []) {
          const taskId = item?.json?.[field];
          if (typeof taskId === "string" && allowedTaskIds.has(taskId)) matches.add(taskId);
        }
      }
    }
  }
  return matches;
}

function lastNode(resultData) {
  const explicit = safeText(resultData?.lastNodeExecuted, "", 120);
  if (explicit) return explicit;
  const fallback = Object.keys(isObject(resultData?.runData) ? resultData.runData : {})
    .filter((nodeName) => ALLOWED_N8N_TASK_NODES.has(nodeName))
    .at(-1);
  return safeText(fallback, "PENDING", 120);
}

async function collectClickup(references, config, fetchImpl, nowIso) {
  const tasks = [];
  const events = [];
  for (const reference of references) {
    const task = await requestJson(
      fetchImpl,
      `https://api.clickup.com/api/v2/task/${reference.clickup_task_id}`,
      { Authorization: config.clickupToken },
    );
    if (!task) continue;
    const updatedAt = isoOrNull(task.date_updated) ?? nowIso;
    const status = safeText(task.status?.status, "OBSERVED", 80);
    tasks.push({ ...reference, observed_at: nowIso, updated_at: updatedAt, status });
    events.push({
      event_id: `clickup:${reference.clickup_task_id}:${updatedAt}`,
      offer_id: reference.offer_id,
      phase: 1,
      event_type: "clickup_task_observed",
      occurred_at: updatedAt,
      source: "clickup",
      state: status,
      blocker_code: null,
    });
  }
  const state = tasks.length === references.length ? "OPERANT" : tasks.length > 0 ? "DEGRADED" : "UNAVAILABLE";
  const detail = state === "OPERANT"
    ? "Tarefas explícitas observadas via leitura read-only."
    : state === "DEGRADED"
      ? "Parte das tarefas explícitas não pôde ser lida."
      : "Nenhuma tarefa explícita pôde ser lida.";
  return { source: source("clickup", "ClickUp", state, `${tasks.length}/${references.length}`, detail, tasks.length ? nowIso : null), tasks, events };
}

async function collectN8n(references, config, fetchImpl, nowIso) {
  const url = new URL("/api/v1/executions", config.n8nBaseUrl);
  url.searchParams.set("workflowId", config.workflowId);
  url.searchParams.set("limit", "20");
  url.searchParams.set("includeData", "true");
  const response = await requestJson(fetchImpl, url, { "X-N8N-API-KEY": config.n8nApiKey });
  if (!response || !Array.isArray(response.data)) {
    return { source: source("n8n", "n8n", "UNAVAILABLE", `0/${references.length}`, "Execuções n8n não puderam ser lidas."), executions: [], events: [] };
  }

  const referencesById = new Map(references.map((reference) => [reference.clickup_task_id, reference]));
  const allowedTaskIds = new Set(referencesById.keys());
  const executions = [];
  const events = [];
  for (const execution of response.data) {
    const executionId = externalIdOrNull(execution?.id);
    if (!executionId) continue;
    const resultData = execution?.data?.resultData;
    const runData = resultData?.runData;
    const taskIds = extractAllowedN8nTaskIds(runData, allowedTaskIds);
    const status = safeText(execution?.status, "OBSERVED", 80);
    const startedAt = isoOrNull(execution?.startedAt) ?? nowIso;
    const stoppedAt = isoOrNull(execution?.stoppedAt);
    for (const taskId of taskIds) {
      const reference = referencesById.get(taskId);
      executions.push({
        offer_id: reference.offer_id,
        clickup_task_id: reference.clickup_task_id,
        locale: reference.locale,
        relation: reference.relation,
        workflow_id: safeText(config.workflowId, "PENDING", 160),
        execution_id: executionId,
        event: "n8n_execution_observed",
        status,
        started_at: startedAt,
        stopped_at: stoppedAt,
        last_node: lastNode(resultData),
      });
      events.push({
        event_id: `n8n:${executionId}:${taskId}`,
        offer_id: reference.offer_id,
        phase: 1,
        event_type: "n8n_execution_observed",
        occurred_at: stoppedAt ?? startedAt,
        source: "n8n",
        state: status,
        blocker_code: null,
      });
    }
  }
  const coverage = new Set(executions.map((item) => item.clickup_task_id)).size;
  return {
    source: source("n8n", "n8n", "OPERANT", `${coverage}/${references.length}`, "Execuções associadas somente por task_id explícito.", nowIso),
    executions,
    events,
  };
}

export async function collectLiveOperation(manifests, { env = process.env, fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch injetável é obrigatório para coletar a operação live.");
  const config = requiredEnvironment(env);
  const references = clickupTaskReferences(manifests);
  const nowIso = new Date(now).toISOString();
  if (references.length === 0) {
    return {
      schema_version: 1,
      mode: "read-only",
      generated_at: nowIso,
      sources: [
        source("clickup", "ClickUp", "UNVERIFIED", "0/0", "Nenhuma referência explícita do piloto."),
        source("n8n", "n8n", "UNVERIFIED", "0/0", "Nenhuma referência explícita do piloto."),
      ],
      clickup_tasks: [],
      n8n_executions: [],
      events: [],
    };
  }
  const [clickup, n8n] = await Promise.all([
    collectClickup(references, config, fetchImpl, nowIso),
    collectN8n(references, config, fetchImpl, nowIso),
  ]);
  return {
    schema_version: 1,
    mode: "read-only",
    generated_at: nowIso,
    sources: [clickup.source, n8n.source],
    clickup_tasks: clickup.tasks,
    n8n_executions: n8n.executions,
    events: [...clickup.events, ...n8n.events],
  };
}

export async function writeLiveOperationArtifact(artifact, outputPath = LIVE_OUTPUT) {
  if (path.resolve(outputPath) !== path.resolve(LIVE_OUTPUT)) throw new Error("Destino de saída fora da allowlist.");
  assertSafeArtifact(artifact);
  const temporary = `${LIVE_OUTPUT}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, LIVE_OUTPUT);
}

export async function refreshLiveStatus(manifests, options = {}) {
  const artifact = await collectLiveOperation(manifests, options);
  await writeLiveOperationArtifact(artifact, options.outputPath);
  return artifact;
}

async function assertCanonicalHub(hubInput) {
  const [hub, expectedHub] = await Promise.all([realpath(hubInput), realpath(DEFAULT_HUB)]);
  if (hub.toLowerCase() !== expectedHub.toLowerCase()) {
    throw new Error(`Hub fora da allowlist: somente ${DEFAULT_HUB} é aceito.`);
  }
  return hub;
}

export async function readCanonicalManifests() {
  const hub = await assertCanonicalHub(DEFAULT_HUB);
  const offersDir = path.join(hub, "registry", "offers");
  const files = (await readdir(offersDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const manifests = [];
  for (const file of files) {
    const raw = await readFile(path.join(offersDir, file), "utf8");
    if (raw.length > 2_000_000) throw new Error(`Manifesto excede 2 MB: ${file}.`);
    manifests.push(JSON.parse(raw));
  }
  return manifests;
}

async function main() {
  if (process.argv.length > 2) throw new Error("Argumentos não permitidos: execute sem argumentos.");
  const artifact = await refreshLiveStatus(await readCanonicalManifests());
  process.stdout.write(`Coleta read-only concluída: ${artifact.clickup_tasks.length} tarefas ClickUp, ${artifact.n8n_executions.length} execuções n8n.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Falha na coleta read-only: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
    process.exitCode = 1;
  });
}
