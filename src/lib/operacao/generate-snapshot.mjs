#!/usr/bin/env node

import { readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_HUB = path.resolve(HERE, "../../../../..");
const OUTPUT = path.join(HERE, "operation.snapshot.json");
const LIVE_OUTPUT = path.join(HERE, "operation.live.json");
const OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EVENT_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const SOURCE_STATES = new Set(["OPERANT", "DEGRADED", "UNAVAILABLE", "UNVERIFIED"]);
const LIVE_SOURCE_IDS = new Set(["clickup", "n8n"]);
const LIVE_EVENT_SOURCE_BY_TYPE = new Map([
  ["clickup_task_observed", "clickup"],
  ["n8n_execution_observed", "n8n"],
]);
const LIVE_STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const FORBIDDEN_KEYS = /^(?:email|e-mail|token|secret|password|cookie|authorization|api[_-]?key|access[_-]?key|private[_-]?key)$/i;
const SECRET_VALUE = /(?:xox[baprs]-|ghp_|glpat-|bearer\s+[a-z0-9._~-]|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CPF_VALUE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PHONE_VALUE = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-])\d{4,5}[\s.-]\d{4}\b/;
const PATH_VALUE = /(?:[A-Za-z]:\\|file:\/\/\/(?:[A-Za-z0-9._-]+\/?)+|(?:^|[\s"'=(])\/(?:[A-Za-z0-9._-]+\/?)+)/;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const OPENAI_KEY_VALUE = /\b(?:sk|pk)_[A-Za-z0-9_-]+\b|\bsk-proj-[A-Za-z0-9_-]+\b|\bpk-[A-Za-z0-9_-]+\b/i;

const PHASES = [
  "Sem etapa comprovada", "Cockpit", "Preflight", "Execução local",
  "Publicação", "Entrega", "Comando", "Métricas",
];

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: esperado objeto JSON.`);
  }
}

function scanSensitive(value, trail = "root", { allowPaths = false } = {}) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanSensitive(child, `${trail}[${index}]`, { allowPaths }));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new Error(`${trail}.${key}: chave sensível recusada.`);
      scanSensitive(child, `${trail}.${key}`, { allowPaths });
    }
    return;
  }
  if (typeof value === "string" && isSensitiveText(value, { allowPaths })) {
    throw new Error(`${trail}: conteúdo sensível recusado.`);
  }
}

function isSensitiveText(value, { allowPaths = false } = {}) {
  return SECRET_VALUE.test(value) || EMAIL_VALUE.test(value) || CPF_VALUE.test(value)
    || PHONE_VALUE.test(value) || (!allowPaths && PATH_VALUE.test(value)) || JWT_VALUE.test(value) || OPENAI_KEY_VALUE.test(value);
}

function safeText(value, fallback = "PENDING", max = 180) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.trim().replace(/[\r\n\t]+/g, " ");
  if (isSensitiveText(normalized)) throw new Error("Texto sensível recusado.");
  return normalized.slice(0, max);
}

function isoOrNull(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sourceRecord(id, label, state, coverage, detail, lastReadAt = null) {
  if (!SOURCE_STATES.has(state)) throw new Error(`Estado inválido para fonte ${id}.`);
  return {
    id,
    label,
    state,
    coverage: safeText(coverage, "PENDING", 40),
    detail: safeText(detail, "PENDING", 180),
    last_read_at: isoOrNull(lastReadAt),
  };
}

function parseArgs(argv) {
  const args = { hub: DEFAULT_HUB, output: OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--hub" || token === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`Valor ausente para ${token}.`);
      args[token.slice(2)] = path.resolve(value);
      index += 1;
      continue;
    }
    if (token === "--check") {
      args.check = true;
      continue;
    }
    if (token === "--local-only" || token === "--offline") {
      args.localOnly = true;
      continue;
    }
    throw new Error(`Argumento não permitido: ${token}`);
  }
  if (args.localOnly && !args.check) {
    throw new Error("--local-only/--offline exige --check; nenhuma escrita foi autorizada.");
  }
  return args;
}

async function assertAllowedPaths(hubInput, outputInput) {
  const hub = await realpath(hubInput);
  const expectedHub = await realpath(DEFAULT_HUB);
  if (hub.toLowerCase() !== expectedHub.toLowerCase()) {
    throw new Error(`--hub fora da allowlist: somente ${DEFAULT_HUB} é aceito.`);
  }
  const output = path.resolve(outputInput);
  if (output.toLowerCase() !== path.resolve(OUTPUT).toLowerCase()) {
    throw new Error("--output fora da allowlist do snapshot versionado.");
  }
  return { hub, output };
}

async function readJson(file, { allowPaths = false } = {}) {
  const raw = await readFile(file, "utf8");
  if (raw.length > 2_000_000) throw new Error(`${path.basename(file)} excede o limite de 2 MB.`);
  const parsed = JSON.parse(raw);
  scanSensitive(parsed, path.basename(file), { allowPaths });
  return parsed;
}

function latestEvents(events) {
  const result = new Map();
  for (const event of events) {
    if (!OFFER_ID.test(String(event.offer_id ?? ""))) continue;
    const occurredAt = isoOrNull(event.occurred_at);
    if (!occurredAt) continue;
    const previous = result.get(event.offer_id);
    if (!previous || occurredAt > previous.occurred_at) result.set(event.offer_id, { ...event, occurred_at: occurredAt });
  }
  return result;
}

function projectEvent(event) {
  if (!EVENT_ID.test(String(event.event_id ?? ""))) throw new Error("event_id inválido no ledger.");
  if (!OFFER_ID.test(String(event.offer_id ?? ""))) throw new Error("offer_id inválido no evento.");
  const phase = Number.isInteger(event.phase) && event.phase >= 1 && event.phase <= 7 ? event.phase : null;
  if (phase === null) throw new Error(`Evento ${event.event_id}: fase inválida.`);
  return {
    event_id: event.event_id,
    offer_id: event.offer_id,
    phase,
    event_type: safeText(event.event_type, "PENDING", 80),
    occurred_at: new Date(event.occurred_at).toISOString(),
    source: safeText(event.source, "PENDING", 40),
    state: safeText(event.state, "PENDING", 80),
    blocker_code: event.blocker_code ? safeText(event.blocker_code, "PENDING", 80) : null,
  };
}

function externalId(value) {
  if (value === null || value === undefined || value === "PENDING") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function projectMetricBinding(manifest) {
  const metrics = manifest.systems?.metrics;
  if (metrics === undefined) return { ...metricBinding(), metric_ids: [] };

  const rawMetricIds = Array.isArray(metrics?.metric_ids) ? metrics.metric_ids.map(externalId) : [];
  const metricIds = [...new Set(rawMetricIds.filter(Boolean))];
  const entityType = typeof metrics?.entity_type === "string" && metrics.entity_type.trim()
    ? metrics.entity_type.trim()
    : null;
  const entityId = externalId(metrics?.entity_id);
  const bancoId = externalId(manifest.systems?.banco_ngv?.offer_tracking_id);
  const lastObservedAt = isoOrNull(metrics?.last_observed_at);
  const idsAreNonEmptyAndUnique = rawMetricIds.length > 0
    && rawMetricIds.every(Boolean)
    && metricIds.length === rawMetricIds.length;
  const confirmed = entityType === "offer_tracking"
    && entityId !== null
    && bancoId !== null
    && entityId === bancoId
    && idsAreNonEmptyAndUnique
    && lastObservedAt !== null;
  const detail = confirmed
    ? "Vínculo de métrica confirmado por entity_type, entity_id e IDs explícitos; nenhuma atribuição por nome foi feita."
    : "Vínculo de métrica divergente: exige entity_type=offer_tracking, entity_id exato do offer_tracking, IDs não vazios/únicos e data válida; nenhuma atribuição por nome foi feita.";

  return {
    status: confirmed ? "CONFIRMED" : "DIVERGENT",
    entity_type: entityType,
    entity_id: entityId,
    metric_ids: metricIds,
    last_observed_at: lastObservedAt,
    detail,
  };
}

function operationExternalIds(manifest) {
  const clickup = [];
  const parent = externalId(manifest.systems?.clickup?.parent_task_id);
  if (parent) clickup.push(parent);
  for (const task of [
    ...(Array.isArray(manifest.systems?.clickup?.task_variants) ? manifest.systems.clickup.task_variants : []),
    ...(Array.isArray(manifest.systems?.clickup?.operational_tasks) ? manifest.systems.clickup.operational_tasks : []),
  ]) {
    const taskId = externalId(task?.task_id);
    if (taskId && !clickup.includes(taskId)) clickup.push(taskId);
  }
  const banco = externalId(manifest.systems?.banco_ngv?.offer_tracking_id);
  const metricBinding = projectMetricBinding(manifest);
  return {
    banco_ngv: banco ? [banco] : [],
    clickup,
    n8n: [],
    pages: [],
    product: [],
    metrics: metricBinding.metric_ids,
  };
}

function metricBinding() {
  return {
    status: "PENDING",
    entity_type: null,
    entity_id: null,
    metric_ids: [],
    last_observed_at: null,
    detail: "Vínculo de métrica não mapeado por ID; nenhuma atribuição por nome foi feita.",
  };
}

function operationEvidence(manifest, externalIds, observedAt, metricsBinding) {
  const evidence = [];
  if (externalIds.banco_ngv[0]) evidence.push({
    source: "banco-ngv",
    external_id: externalIds.banco_ngv[0],
    relation: "offer_tracking",
    state: safeText(manifest.technical?.source_status, manifest.status, 180),
    observed_at: observedAt,
  });
  if (externalIds.clickup[0]) evidence.push({
    source: "clickup",
    external_id: externalIds.clickup[0],
    relation: "parent_task",
    state: "PENDING",
    observed_at: observedAt,
  });
  const metrics = manifest.systems?.metrics;
  if (metricsBinding.metric_ids.length > 0) {
    for (const metricId of metricsBinding.metric_ids) evidence.push({
      source: safeText(metrics?.platform, "metrics", 40),
      external_id: metricId,
      relation: safeText(metrics?.evidence_ref, "metric_id", 180),
      state: metricsBinding.status,
      observed_at: metricsBinding.last_observed_at,
    });
  }
  return evidence;
}

export function projectManifest(manifest, latest) {
  assertPlainObject(manifest, "manifest");
  if (!OFFER_ID.test(String(manifest.offer_id ?? "")) || !SLUG.test(String(manifest.offer_slug ?? ""))) {
    throw new Error("Manifesto com identidade inválida.");
  }
  const explicitBlockers = Array.isArray(manifest.blockers)
    ? manifest.blockers.filter((item) => typeof item === "string" && item.trim()).map((item) => ({
        code: "MANIFEST_PENDING",
        detail: safeText(item, "Pendência sem descrição", 240),
        source: "registry",
        severity: "PENDING",
        occurred_at: isoOrNull(manifest.last_verified),
      }))
    : [];
  const eventBlocked = latest?.event_type === "blocked" || String(latest?.state ?? "").toUpperCase() === "BLOCKED";
  const blockers = [...explicitBlockers];
  if (eventBlocked) blockers.unshift({
    code: safeText(latest.blocker_code, "OPERATION_BLOCKED", 80),
    detail: "Bloqueio registrado no ledger local sanitizado.",
    source: safeText(latest.source, "ledger", 40),
    severity: "BLOCKED",
    occurred_at: latest.occurred_at,
  });
  const phase = latest && Number.isInteger(latest.phase) ? latest.phase : 0;
  const hasConfirmedBlocker = blockers.some((blocker) => blocker.severity === "BLOCKED");
  const state = hasConfirmedBlocker
    ? "BLOCKED"
    : latest
      ? (phase === 7 && /ready/i.test(String(latest.state ?? "")) ? "READY_FOR_REVIEW" : "IN_MOTION")
      : "PENDING";
  const externalIds = operationExternalIds(manifest);
  const metricsBinding = projectMetricBinding(manifest);
  const observedAt = latest?.occurred_at ?? isoOrNull(manifest.last_verified);
  const identityReconciliationStatus = externalIds.banco_ngv.length > 0 && externalIds.clickup.length > 0
    ? "CONFIRMED"
    : "PENDING";
  const reconciliationStatus = metricsBinding.status === "DIVERGENT"
    ? "DIVERGENT"
    : identityReconciliationStatus;
  const reconciliationEvidence = [...new Set([
    ...externalIds.banco_ngv.map((id) => `offer_tracking:${id}`),
    ...externalIds.clickup.map((id) => `clickup:${id}`),
    ...externalIds.metrics.map((id) => `metrics:${id}`),
  ])];
  const evidence = operationEvidence(manifest, externalIds, observedAt, metricsBinding);
  if (latest) evidence.push({
    source: safeText(latest.source, "ledger", 40),
    external_id: safeText(latest.event_id, "PENDING", 160),
    relation: "operation_event",
    state: safeText(latest.state, "PENDING", 80),
    observed_at: observedAt,
  });
  return {
    offer_id: manifest.offer_id,
    offer_slug: manifest.offer_slug,
    display_name: safeText(manifest.identity?.display_name, manifest.offer_slug, 100),
    language: safeText(manifest.identity?.language, "PENDING", 12),
    phase,
    state,
    source_of_truth: "banco-ngv",
    external_ids: externalIds,
    reconciliation: {
      status: reconciliationStatus,
      evidence: reconciliationEvidence,
    },
    source_status: safeText(manifest.technical?.source_status, manifest.status, 180),
    aggregated_status: state,
    next_owner: safeText(manifest.next_owner, "PENDING", 100),
    evidence,
    metric_binding: metricsBinding,
    blockers,
    last_evidence_at: latest?.occurred_at ?? isoOrNull(manifest.last_verified),
  };
}

function countReferences(manifests, selector) {
  return manifests.filter((manifest) => {
    const value = selector(manifest);
    return typeof value === "string" && value !== "PENDING" && value.length > 0;
  }).length;
}

export function projectLiveArtifact(value, knownOfferIds) {
  assertPlainObject(value, "operation.live");
  if (value.schema_version !== 1 || value.mode !== "read-only" || !isoOrNull(value.generated_at)) {
    throw new Error("operation.live inválido.");
  }
  scanSensitive(value, "operation.live");
  const sourceById = new Map();
  for (const source of Array.isArray(value.sources) ? value.sources : []) {
    if (!isPlainObject(source) || !["clickup", "n8n"].includes(source.id) || !SOURCE_STATES.has(source.state)) continue;
    const lastReadAt = isoOrNull(source.last_read_at);
    if (source.state === "OPERANT" && !lastReadAt) throw new Error(`Fonte live ${source.id} OPERANT exige last_read_at.`);
    sourceById.set(source.id, sourceRecord(source.id, source.id === "clickup" ? "ClickUp" : "n8n", source.state, source.coverage, source.detail, lastReadAt));
  }
  const clickupTasks = Array.isArray(value.clickup_tasks)
    ? value.clickup_tasks
      .map((task) => projectClickupTask(task, knownOfferIds, value.generated_at))
      .filter(Boolean)
    : [];
  const events = Array.isArray(value.events)
    ? value.events.map(projectEvent).filter((event) => (event.source === "clickup" || event.source === "n8n") && knownOfferIds.has(event.offer_id)).map((event) => ({ ...event, phase: 1 }))
    : [];
  return { generated_at: isoOrNull(value.generated_at), sources: sourceById, clickup_tasks: clickupTasks, events };
}

function normalizedClickupStatus(value) {
  return typeof value === "string"
    ? value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    : "";
}

function isClosedClickupStatus(value) {
  return new Set(["finalizado", "finalizada", "concluido", "concluida", "complete", "completed", "closed"])
    .has(normalizedClickupStatus(value));
}

function isConfirmedClickupBlocker(value) {
  return ["blocked", "bloqueado", "bloqueada"].includes(normalizedClickupStatus(value));
}

function projectClickupTask(task, knownOfferIds, fallbackObservedAt) {
  if (!isPlainObject(task) || !knownOfferIds.has(task.offer_id)) return null;
  const taskId = String(task.clickup_task_id ?? "");
  if (!/^[A-Za-z0-9]{1,80}$/.test(taskId)) throw new Error("clickup_task_id inválido no artefato live.");
  const observedAt = isoOrNull(task.observed_at) ?? isoOrNull(fallbackObservedAt);
  const updatedAt = isoOrNull(task.updated_at) ?? observedAt;
  return {
    offer_id: task.offer_id,
    clickup_task_id: taskId,
    relation: safeText(task.relation, "operational_task", 80),
    locale: safeText(task.locale, "PENDING", 12),
    phase: Number.isInteger(task.phase) && task.phase >= 0 && task.phase <= 7 ? task.phase : 1,
    owner: safeText(task.owner, "PENDING", 100),
    status: safeText(task.status, "OBSERVED", 80),
    observed_at: observedAt,
    updated_at: updatedAt,
  };
}

async function readLiveArtifact(knownOfferIds) {
  try {
    return projectLiveArtifact(await readJson(LIVE_OUTPUT), knownOfferIds);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

export function isLiveArtifactStale(generatedAt, now = Date.now()) {
  const generatedAtMs = new Date(generatedAt).getTime();
  return Number.isNaN(generatedAtMs) || now - generatedAtMs > LIVE_STALE_AFTER_MS;
}

function sourceWithFreshness(source, generatedAt, now) {
  const stale = isLiveArtifactStale(generatedAt, now);
  if (!stale || source.state === "UNAVAILABLE" || source.state === "UNVERIFIED") return source;
  return sourceRecord(source.id, source.label, "DEGRADED", source.coverage, "Evidência live com mais de 12 horas.", source.last_read_at);
}

export function mergeLiveEvidence(snapshot, liveArtifact, now = Date.now()) {
  if (!liveArtifact) return snapshot;
  const sources = snapshot.sources.map((source) => {
    const live = liveArtifact.sources.get(source.id);
    return live ? sourceWithFreshness(live, liveArtifact.generated_at, now) : source;
  });
  const eventsById = new Map();
  for (const event of snapshot.events) eventsById.set(event.event_id, event);
  for (const event of liveArtifact.events) eventsById.set(event.event_id, { ...event, phase: 1 });
  const events = [...eventsById.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 100);
  const clickupTasks = Array.isArray(liveArtifact.clickup_tasks) ? liveArtifact.clickup_tasks : [];
  const tasksByOffer = new Map();
  for (const task of clickupTasks) {
    const tasks = tasksByOffer.get(task.offer_id) ?? [];
    tasks.push(task);
    tasksByOffer.set(task.offer_id, tasks);
  }
  const offers = snapshot.offers.map((offer) => {
    const tasks = tasksByOffer.get(offer.offer_id) ?? [];
    if (tasks.length === 0) return offer;
    const openTasks = tasks.filter((task) => !isClosedClickupStatus(task.status));
    const blockedTask = tasks.find((task) => isConfirmedClickupBlocker(task.status));
    const hasConfirmedBlocker = offer.blockers.some((blocker) => blocker.severity === "BLOCKED") || Boolean(blockedTask);
    const parentTask = tasks.find((task) => task.relation === "parent_task");
    const taskEvidence = tasks.map((task) => ({
      source: "clickup",
      external_id: task.clickup_task_id,
      relation: task.relation,
      state: task.status,
      observed_at: task.observed_at ?? task.updated_at,
    }));
    const observedTaskKeys = new Set(taskEvidence.map((item) => `${item.source}:${item.external_id}:${item.relation}`));
    const baseEvidence = offer.evidence.filter((item) => !observedTaskKeys.has(`${item.source}:${item.external_id}:${item.relation}`));
    const blockers = blockedTask && !offer.blockers.some((blocker) => blocker.code === "CLICKUP_BLOCKED")
      ? [{
          code: "CLICKUP_BLOCKED",
          detail: "Bloqueio explicitamente observado no status da tarefa ClickUp.",
          source: "clickup",
          severity: "BLOCKED",
          occurred_at: blockedTask.updated_at ?? blockedTask.observed_at,
        }, ...offer.blockers]
      : offer.blockers;
    const aggregatedStatus = hasConfirmedBlocker
      ? "BLOCKED"
      : openTasks.length > 0
        ? "IN_MOTION"
        : offer.aggregated_status;
    const lastTaskAt = tasks
      .map((task) => task.updated_at ?? task.observed_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? offer.last_evidence_at;
    const phase = Math.max(
      Number.isInteger(offer.phase) ? offer.phase : 0,
      ...openTasks.map((task) => Number.isInteger(task.phase) ? task.phase : 0),
    );
    return {
      ...offer,
      phase,
      source_status: parentTask?.status ?? offer.source_status,
      aggregated_status: aggregatedStatus,
      state: aggregatedStatus,
      next_owner: openTasks.find((task) => task.owner !== "PENDING")?.owner ?? offer.next_owner,
      evidence: [...baseEvidence, ...taskEvidence],
      blockers,
      last_evidence_at: lastTaskAt,
    };
  });
  return { ...snapshot, offers, sources, events };
}

export function normalizeSnapshotForCheck(current, expected) {
  assertPlainObject(current, "snapshot versionado");
  assertPlainObject(expected, "snapshot projetado");
  if (!Array.isArray(current.sources) || !Array.isArray(current.events)) {
    throw new Error("Snapshot versionado exige arrays sources e events.");
  }
  if (!Array.isArray(expected.sources) || !Array.isArray(expected.events)) {
    throw new Error("Snapshot projetado exige arrays sources e events.");
  }
  scanSensitive(current, "snapshot");

  const normalized = structuredClone(current);
  normalized.generated_at = expected.generated_at;
  for (const source of normalized.sources) {
    if (!isPlainObject(source)) continue;
    const projected = expected.sources.find((item) => item.id === source.id);
    if (projected?.last_read_at === expected.generated_at) source.last_read_at = projected.last_read_at;
  }
  return normalized;
}

function persistedLiveSource(source) {
  if (!isPlainObject(source) || !LIVE_SOURCE_IDS.has(source.id)) return null;
  const projected = sourceRecord(
    source.id,
    source.id === "clickup" ? "ClickUp" : "n8n",
    source.state,
    source.coverage,
    source.detail,
    source.last_read_at,
  );
  const expectedKeys = Object.keys(projected).sort();
  const actualKeys = Object.keys(source).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Fonte live persistida ${source.id} possui campos fora do contrato.`);
  }
  for (const key of expectedKeys) {
    if (source[key] !== projected[key]) throw new Error(`Fonte live persistida ${source.id} inválida.`);
  }
  if (["OPERANT", "DEGRADED"].includes(source.state) && !source.last_read_at) {
    throw new Error(`Fonte live persistida ${source.id} exige last_read_at.`);
  }
  return projected;
}

function persistedLiveEvent(event, knownOfferIds) {
  if (!isPlainObject(event) || LIVE_EVENT_SOURCE_BY_TYPE.get(event.event_type) !== event.source) return null;
  const projected = projectEvent(event);
  const expectedKeys = Object.keys(projected).sort();
  const actualKeys = Object.keys(event).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Evento live persistido ${event.event_id ?? "PENDING"} possui campos fora do contrato.`);
  }
  for (const key of expectedKeys) {
    if (event[key] !== projected[key]) throw new Error(`Evento live persistido ${event.event_id} inválido.`);
  }
  if (projected.phase !== 1 || !knownOfferIds.has(projected.offer_id)) {
    throw new Error(`Evento live persistido ${projected.event_id} fora do escopo conhecido.`);
  }
  return projected;
}

export function expectedSnapshotForCheck(current, expected, { liveInputPresent = true } = {}) {
  if (liveInputPresent) return expected;
  assertPlainObject(current, "snapshot versionado");
  assertPlainObject(expected, "snapshot projetado");
  if (!Array.isArray(current.sources) || !Array.isArray(current.events) || !Array.isArray(expected.sources) || !Array.isArray(expected.events) || !Array.isArray(expected.offers)) {
    throw new Error("Snapshots comparados exigem arrays offers, sources e events.");
  }
  scanSensitive(current, "snapshot");

  const overlaySources = new Map();
  for (const source of current.sources) {
    const projected = persistedLiveSource(source);
    if (!projected) continue;
    if (overlaySources.has(projected.id)) throw new Error(`Fonte live persistida ${projected.id} duplicada.`);
    overlaySources.set(projected.id, projected);
  }

  const knownOfferIds = new Set(expected.offers.map((offer) => offer.offer_id));
  const overlayEvents = [];
  for (const event of current.events) {
    const projected = persistedLiveEvent(event, knownOfferIds);
    if (projected) overlayEvents.push(projected);
  }

  const projected = structuredClone(expected);
  projected.sources = projected.sources.map((source) => overlaySources.get(source.id) ?? source);
  const eventsById = new Map(projected.events.map((event) => [event.event_id, event]));
  for (const event of overlayEvents) eventsById.set(event.event_id, event);
  projected.events = [...eventsById.values()]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 100);
  return projected;
}

async function readManifests(hub) {
  const offersDir = path.join(hub, "registry", "offers");
  const files = (await readdir(offersDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const manifests = [];
  for (const file of files) manifests.push(await readJson(path.join(offersDir, file), { allowPaths: true }));
  return manifests;
}

async function buildSnapshotResult(hub, { now = Date.now(), localOnly = false } = {}) {
  const manifests = await readManifests(hub);
  const identityMap = await readJson(path.join(hub, "registry", "offer-id-map.json"), { allowPaths: true });
  const ledger = await readJson(path.join(hub, "state", "operation-ledger.json"));
  assertPlainObject(identityMap, "offer-id-map");
  assertPlainObject(ledger, "operation-ledger");
  const events = Array.isArray(ledger.events) ? ledger.events.map(projectEvent) : [];
  const latestByOffer = latestEvents(events);
  const offers = manifests.map((manifest) => projectManifest(manifest, latestByOffer.get(manifest.offer_id)));

  const ambiguous = Array.isArray(identityMap.entries)
    ? identityMap.entries.filter((entry) => entry?.status === "AMBIGUOUS")
    : [];
  for (const entry of ambiguous) {
    const slug = safeText(entry.source_slug, "ambiguous", 80).toLowerCase().replace(/_/g, "-");
    offers.push({
      offer_id: `ngv:ambiguous-${slug}`,
      offer_slug: slug,
      display_name: safeText(entry.source_slug, "Identidade ambígua", 100),
      language: "PENDING",
      phase: 0,
      state: "BLOCKED",
      source_of_truth: "banco-ngv",
      external_ids: { banco_ngv: [], clickup: [], n8n: [], pages: [], product: [], metrics: [] },
      reconciliation: { status: "DIVERGENT", evidence: [safeText(entry.evidence, "Identidade canônica não resolvida.", 240)] },
      source_status: "IDENTITY_AMBIGUOUS",
      aggregated_status: "BLOCKED",
      next_owner: "PENDING",
      evidence: [{
        source: "offer-id-map",
        external_id: safeText(entry.source_slug, "ambiguous", 80),
        relation: "identity",
        state: "AMBIGUOUS",
        observed_at: null,
      }],
      metric_binding: metricBinding(),
      blockers: [{ code: "IDENTITY_AMBIGUOUS", detail: safeText(entry.evidence, "Identidade canônica não resolvida.", 240), source: "offer-id-map", severity: "BLOCKED", occurred_at: null }],
      last_evidence_at: null,
    });
  }
  offers.sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));

  const total = manifests.length;
  const refs = {
    clickup: countReferences(manifests, (item) => item.systems?.clickup?.parent_task_id),
    drive: countReferences(manifests, (item) => item.systems?.clickup?.documento_principal_url),
    vercel: manifests.filter((item) => Array.isArray(item.systems?.vercel?.production_urls) && item.systems.vercel.production_urls.length > 0).length,
    banco: countReferences(manifests, (item) => item.systems?.banco_ngv?.offer_tracking_id),
    monitoramento: countReferences(manifests, (item) => item.systems?.monitoramento_ngv?.project_slug),
    apps: countReferences(manifests, (item) => item.systems?.apps_ofertas?.offer_slug),
  };
  const generatedAt = new Date(now).toISOString();
  const unverified = (id, label, count) => ({ id, label, state: "UNVERIFIED", coverage: `${count}/${total}`, detail: "Referências locais presentes; nenhuma consulta externa foi executada.", last_read_at: null });
  const sources = [
    { id: "registry", label: "Registry", state: "OPERANT", coverage: `${total}/${total}`, detail: "Manifestos locais lidos e projetados.", last_read_at: generatedAt },
    { id: "ledger", label: "Ledger", state: "OPERANT", coverage: `${events.length} eventos`, detail: "Ledger local sanitizado lido sem rede.", last_read_at: generatedAt },
    unverified("clickup", "ClickUp", refs.clickup),
    unverified("drive", "Drive", refs.drive),
    unverified("vercel", "Publicação", refs.vercel),
    unverified("banco", "Banco NGV", refs.banco),
    unverified("monitoramento", "Monitoramento", refs.monitoramento),
    unverified("apps", "Apps Ofertas", refs.apps),
    { id: "n8n", label: "n8n", state: "UNVERIFIED", coverage: "PENDING", detail: "Blueprint local não prova workflow ativo.", last_read_at: null },
    { id: "runner", label: "Runner", state: "UNVERIFIED", coverage: "PENDING", detail: "Snapshot não executa diagnóstico do serviço.", last_read_at: null },
  ];

  const snapshot = {
    schema_version: 1,
    generated_at: generatedAt,
    source: "ngv-hub-local-projection",
    mode: "read-only",
    phases: PHASES.map((label, phase) => ({ phase, label })),
    offers,
    sources,
    events: events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 100),
  };
  const liveArtifact = await readLiveArtifact(new Set(manifests.map((manifest) => manifest.offer_id)));
  const mergeNow = localOnly && liveArtifact
    ? new Date(liveArtifact.generated_at).getTime()
    : now;
  return {
    snapshot: mergeLiveEvidence(snapshot, liveArtifact, mergeNow),
    liveInputPresent: liveArtifact !== null,
    liveArtifact,
  };
}

export async function buildSnapshot(hub, options = {}) {
  return (await buildSnapshotResult(hub, options)).snapshot;
}

export async function writeSnapshotAtomic(value, output = OUTPUT) {
  if (path.resolve(output) !== path.resolve(OUTPUT)) throw new Error("Destino de escrita fora da allowlist.");
  scanSensitive(value, "snapshot");
  const temporary = `${output}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, output);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { hub, output } = await assertAllowedPaths(args.hub, args.output);
  const { snapshot, liveInputPresent, liveArtifact } = await buildSnapshotResult(hub, { localOnly: args.localOnly });
  scanSensitive(snapshot, "snapshot");
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (args.check) {
    const current = await readFile(output, "utf8");
    const committed = JSON.parse(current);
    const expected = JSON.parse(serialized);
    if (liveInputPresent && !args.localOnly && liveArtifact
      && isLiveArtifactStale(liveArtifact.generated_at)) {
      throw new Error("operation.live excede 12 horas; use --check --local-only somente para validação local determinística.");
    }
    const normalized = normalizeSnapshotForCheck(committed, expected);
    const comparableExpected = expectedSnapshotForCheck(committed, expected, { liveInputPresent });
    if (JSON.stringify(normalized) !== JSON.stringify(comparableExpected)) throw new Error("Snapshot versionado diverge da projeção local.");
    const suffix = args.localOnly
      ? " Modo local-only: artefato live local validado sem rede e sem gate de idade."
      : liveInputPresent
        ? ""
        : " Overlay live persistido validado sem artefato mutável.";
    process.stdout.write(`PASS snapshot: ${committed.offers.length} ofertas, ${committed.events.length} eventos, modo read-only.${suffix}\n`);
    return;
  }
  await writeSnapshotAtomic(snapshot, output);
  process.stdout.write(`Snapshot atualizado: ${snapshot.offers.length} ofertas, ${snapshot.events.length} eventos, modo read-only.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Falha ao gerar snapshot: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
    process.exitCode = 1;
  });
}
