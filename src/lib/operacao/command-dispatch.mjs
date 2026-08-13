import { createHmac } from "node:crypto";
import { canonicalJson, commandDigest } from "./command-ledger.mjs";

export const MAX_COMMAND_REQUEST_BYTES = 64 * 1024;
export const MAX_COMMAND_RESPONSE_BYTES = 64 * 1024;
const PATH = "/webhook/codex-operation/command";

export class OperationCommandDispatchError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "OperationCommandDispatchError";
    this.code = code;
  }
}

/** @returns {never} */
function fail(code) {
  throw new OperationCommandDispatchError(code);
}

function allowlist(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function resolveConfig(config = {}) {
  const requestedTimeout = Number(config.timeoutMs ?? 5000);
  return {
    url: config.url ?? process.env.OPERATION_COMMAND_INTAKE_URL,
    secret: config.secret ?? process.env.OPERATION_COMMAND_INTAKE_SECRET,
    hostAllowlist: config.hostAllowlist ?? process.env.OPERATION_COMMAND_INTAKE_HOST_ALLOWLIST,
    timeoutMs: Number.isFinite(requestedTimeout) ? Math.min(5000, Math.max(1, requestedTimeout)) : 5000,
    maxRequestBytes: MAX_COMMAND_REQUEST_BYTES,
    maxResponseBytes: MAX_COMMAND_RESPONSE_BYTES,
  };
}

function validateUrl(raw, hosts) {
  if (typeof raw !== "string" || !raw || typeof hosts !== "string" && !Array.isArray(hosts)) fail("INTAKE_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("INTAKE_URL_INVALID"); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.search || url.hash || url.pathname !== PATH) fail("INTAKE_URL_INVALID");
  if (!allowlist(hosts).includes(url.hostname.toLowerCase())) fail("INTAKE_HOST_NOT_ALLOWLISTED");
  return url;
}

export async function readLimited(response, limit = MAX_COMMAND_RESPONSE_BYTES) {
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
    if (error instanceof OperationCommandDispatchError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function optionalReceipt(body, receipt) {
  if (Object.prototype.hasOwnProperty.call(body, "returned_job_id")) {
    if (typeof body.returned_job_id !== "string" || !/^[0-9a-f]{64}$/.test(body.returned_job_id)) fail("RESPONSE_ENVELOPE_INVALID");
    receipt.returned_job_id = body.returned_job_id;
  }
  if (Object.prototype.hasOwnProperty.call(body, "state")) {
    if (!["queued", "leased", "running", "ready_for_review", "waiting_human", "failed", "completed"].includes(body.state)) fail("RESPONSE_ENVELOPE_INVALID");
    receipt.state = body.state;
  }
  if (Object.prototype.hasOwnProperty.call(body, "created_at")) {
    if (typeof body.created_at !== "string" || body.created_at.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(body.created_at) || Number.isNaN(Date.parse(body.created_at))) fail("RESPONSE_ENVELOPE_INVALID");
    receipt.created_at = body.created_at;
  }
}

function normalize(responseStatus, body, command) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("RESPONSE_ENVELOPE_INVALID");
  const required = ["http_status", "accepted", "code", "returned_command_id", "returned_payload_hash"];
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(body, key))) fail("RESPONSE_ENVELOPE_INVALID");
  if (![200, 202, 409].includes(body.http_status) || typeof body.accepted !== "boolean" || typeof body.code !== "string") fail("RESPONSE_ENVELOPE_INVALID");
  if (body.returned_command_id !== command.command_id || body.returned_payload_hash !== commandDigest(command)) fail("RESPONSE_ENVELOPE_MISMATCH");
  if (responseStatus !== 200 && responseStatus !== body.http_status) fail("RESPONSE_TRANSPORT_MISMATCH");
  const expected = {
    202: [true, "ENQUEUED"],
    200: [true, "DUPLICATE"],
    409: [false, "COMMAND_ID_COLLISION"],
  }[body.http_status];
  if (body.accepted !== expected[0] || body.code !== expected[1]) fail("RESPONSE_ENVELOPE_INVALID");
  const receipt = { http_status: body.http_status, accepted: body.accepted, code: body.code, returned_command_id: body.returned_command_id, returned_payload_hash: body.returned_payload_hash };
  optionalReceipt(body, receipt);
  return receipt;
}

export async function dispatchOperationCommand(command, options = {}) {
  const config = resolveConfig(options.config);
  const url = validateUrl(config.url, config.hostAllowlist);
  if (typeof config.secret !== "string" || !config.secret) fail("INTAKE_SECRET_MISSING");
  const body = canonicalJson(command);
  const bytes = new TextEncoder().encode(body);
  if (bytes.byteLength > config.maxRequestBytes) fail("REQUEST_TOO_LARGE");
  const signature = createHmac("sha256", config.secret).update(bytes).digest("hex");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-signature": signature },
      body,
    });
    let parsed;
    try { parsed = JSON.parse(await readLimited(response, config.maxResponseBytes)); }
    catch (error) { if (error instanceof OperationCommandDispatchError) throw error; fail("RESPONSE_JSON_INVALID"); }
    return normalize(response.status, parsed, command);
  } catch (error) {
    if (error instanceof OperationCommandDispatchError) throw error;
    if (error?.name === "AbortError") fail("INTAKE_TIMEOUT");
    fail("INTAKE_UNAVAILABLE");
  } finally { clearTimeout(timer); }
}

export const dispatchCommand = dispatchOperationCommand;
