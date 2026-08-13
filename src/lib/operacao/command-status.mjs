export const MAX_COMMAND_STATUS_BYTES = 64 * 1024;
export const MAX_COMMAND_STATUS_RESULT_BYTES = 32 * 1024;
export const MAX_COMMAND_STATUS_ERROR_BYTES = 4096;
export const MAX_COMMAND_STATUS_RESULT_DEPTH = 8;
export const MAX_COMMAND_STATUS_RESULT_NODES = 2000;
export const COMMAND_STATUS_PATH = "/webhook/codex-operation/status";

const COMMAND_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const JOB_ID = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(["consult", "create", "edit", "comment", "attach", "complete", "reopen", "approve"]);
const STATES = new Set(["queued", "leased", "running", "ready_for_review", "waiting_human", "failed", "completed"]);
const TERMINAL_STATES = new Set(["ready_for_review", "waiting_human", "failed", "completed"]);
const DISPLAY_STATES = Object.freeze({
  queued: "queued",
  leased: "queued",
  running: "running",
  ready_for_review: "waiting_human",
  waiting_human: "waiting_human",
  failed: "failed",
  completed: "succeeded_candidate",
});

export function displayStateForOutbox(outboxState) {
  return DISPLAY_STATES[outboxState] ?? null;
}

export class OperationCommandStatusError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "OperationCommandStatusError";
    this.code = code;
  }
}

function fail(code) {
  throw new OperationCommandStatusError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function allowlist(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function resolveConfig(config = {}) {
  const timeout = Number(config.timeoutMs ?? 5000);
  return {
    enabled: config.enabled ?? process.env.OPERATION_COMMAND_STATUS_ENABLED ?? false,
    url: config.url ?? process.env.OPERATION_COMMAND_STATUS_URL ?? "",
    secret: config.secret ?? process.env.OPERATION_COMMAND_STATUS_SECRET ?? "",
    hostAllowlist: config.hostAllowlist ?? process.env.OPERATION_COMMAND_STATUS_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(timeout) ? Math.min(5000, Math.max(1, timeout)) : 5000,
  };
}

function isEnabled(value) {
  return value === true || value === "true";
}

function validateUrl(raw, hosts) {
  if (typeof raw !== "string" || !raw || (typeof hosts !== "string" && !Array.isArray(hosts))) fail("STATUS_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("STATUS_URL_INVALID"); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.search || url.hash || url.pathname !== COMMAND_STATUS_PATH) fail("STATUS_URL_INVALID");
  if (!allowlist(hosts).includes(url.hostname.toLowerCase())) fail("STATUS_HOST_NOT_ALLOWLISTED");
  return url;
}

export async function readStatusStream(response, limit = MAX_COMMAND_STATUS_BYTES) {
  if (!response?.body || typeof response.body.getReader !== "function") fail("RESPONSE_BODY_UNREADABLE");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) fail("RESPONSE_BODY_UNREADABLE");
      total += part.value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof OperationCommandStatusError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function iso(value, nullable = false) {
  if (nullable && value === null) return true;
  return typeof value === "string" && value.length <= 64 && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function safeError(value) {
  if (value === null) return true;
  if (typeof value !== "string" || bytes(value) > MAX_COMMAND_STATUS_ERROR_BYTES) return false;
  return !/(?:bearer\s+|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b\d{3}[-.]\d{3}[-.]\d{3}[-.]\d{2}\b|\b\d{11}\b|\+?\d[\d ()-]{8,}\d|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i.test(value);
}

function safeResult(value, depth = 0, state = { nodes: 0 }, key = "") {
  state.nodes += 1;
  if (state.nodes > MAX_COMMAND_STATUS_RESULT_NODES || depth > MAX_COMMAND_STATUS_RESULT_DEPTH) return false;
  if (/(?:secret|token|password|api[_-]?key|authorization|cookie|email|phone|cpf|ssn|jwt|private[_-]?key)/i.test(key)) return false;
  if (typeof value === "string") return safeError(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every((item) => safeResult(item, depth + 1, state));
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(([childKey, childValue]) => safeResult(childValue, depth + 1, state, childKey));
}

function normalizeResult(body, transportStatus) {
  if (!isPlainObject(body) || !["ok", "http_status", "code", "operation_command_result"].every((key) => key in body)) fail("RESPONSE_ENVELOPE_INVALID");
  if (transportStatus !== 200 && transportStatus !== body.http_status) fail("RESPONSE_TRANSPORT_MISMATCH");
  if (body.code === "COMMAND_NOT_FOUND" && body.http_status === 404 && body.ok === false) {
    if (body.operation_command_result !== null) fail("RESPONSE_ENVELOPE_INVALID");
    return { kind: "not_found", ok: false, http_status: 404, code: "COMMAND_NOT_FOUND", operation_command_result: null };
  }
  if (body.code !== "OPERATION_COMMAND_RESULT" || body.http_status !== 200 || body.ok !== true || !isPlainObject(body.operation_command_result)) fail("RESPONSE_ENVELOPE_INVALID");
  const result = body.operation_command_result;
  if (result.command_id !== body._requested_command_id) fail("RESPONSE_ENVELOPE_MISMATCH");
  if (!JOB_ID.test(result.job_id) || !ACTIONS.has(result.action) || !STATES.has(result.outbox_state) || !isPlainObject(result.result) || bytes(JSON.stringify(result.result)) > MAX_COMMAND_STATUS_RESULT_BYTES || !safeResult(result.result) || !safeError(result.sanitized_error) || !Number.isInteger(result.lease_generation) || result.lease_generation < 0 || !iso(result.updated_at) || !iso(result.completed_at, true)) fail("RESPONSE_ENVELOPE_INVALID");
  return { kind: "success", ok: true, http_status: 200, code: "OPERATION_COMMAND_RESULT", operation_command_result: { ...result } };
}

function publicRemoteError(error) {
  if (error instanceof OperationCommandStatusError) throw error;
  if (error?.name === "AbortError") fail("STATUS_TIMEOUT");
  fail("STATUS_UNAVAILABLE");
}

export async function fetchOperationCommandStatus(commandId, options = {}) {
  const config = resolveConfig(options.config);
  if (!isEnabled(config.enabled)) return { kind: "disabled", ok: false, code: "STATUS_DISABLED" };
  if (typeof commandId !== "string" || !COMMAND_ID.test(commandId)) fail("COMMAND_ID_INVALID");
  const url = validateUrl(config.url, config.hostAllowlist);
  if (typeof config.secret !== "string" || !config.secret) fail("STATUS_SECRET_MISSING");
  const payload = JSON.stringify({ schema_version: 1, command_id: commandId });
  if (bytes(payload) > MAX_COMMAND_STATUS_BYTES) fail("REQUEST_TOO_LARGE");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-operation-status-secret": config.secret },
      body: payload,
    });
    if ([400, 401, 403, 422].includes(response.status)) fail(response.status === 401 || response.status === 403 ? "STATUS_AUTH_FAILED" : "STATUS_REQUEST_INVALID");
    let body;
    try { body = JSON.parse(await readStatusStream(response)); } catch (error) { if (error instanceof OperationCommandStatusError) throw error; fail("RESPONSE_JSON_INVALID"); }
    body._requested_command_id = commandId;
    return normalizeResult(body, response.status);
  } catch (error) {
    publicRemoteError(error);
  } finally { clearTimeout(timer); }
}

export const getOperationCommandStatus = fetchOperationCommandStatus;

export function decideStatusReconciliation(previous, incoming) {
  const prev = isPlainObject(previous) ? previous : {};
  const next = isPlainObject(incoming) ? incoming : {};
  const previousState = prev.outbox_state ?? prev.state;
  const incomingState = next.outbox_state ?? next.state;
  const previousGeneration = prev.lease_generation;
  const incomingGeneration = next.lease_generation;
  if (!STATES.has(previousState) || !STATES.has(incomingState) || !Number.isInteger(previousGeneration) || !Number.isInteger(incomingGeneration) || !iso(prev.updated_at) || !iso(next.updated_at)) return { decision: "terminal_conflict", reason: "invalid_state_or_clock", display_state: null, outbox_state: incomingState };
  if (incomingGeneration < previousGeneration || (incomingGeneration === previousGeneration && Date.parse(next.updated_at) <= Date.parse(prev.updated_at))) return { decision: "stale", reason: "older_generation_or_timestamp", display_state: displayStateForOutbox(incomingState), outbox_state: incomingState };
  if (TERMINAL_STATES.has(previousState) && incomingState !== previousState) return { decision: "terminal_conflict", reason: "previous_terminal_state_cannot_change", display_state: displayStateForOutbox(incomingState), outbox_state: incomingState };
  return { decision: "apply", reason: "newer_status", display_state: displayStateForOutbox(incomingState), outbox_state: incomingState };
}
