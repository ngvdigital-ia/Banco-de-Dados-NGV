// Emissor agregado diário para o NGV Core (Supabase Edge Function
// POST /functions/v1/banco-global-daily-ingest, produção).
// Payload SEM PII: apenas contagens e timestamps. Nunca registra
// apikey, URL ou payload — e nenhum dado sai do banco além dos agregados.
//
// Config (server-side, ver .env.example):
//   NGV_CORE_URL            https://<project>.supabase.co/functions/v1/banco-global-daily-ingest
//   NGV_CORE_WRITER_KEY     credencial de escrita do NGV Core (header privado)
//   NGV_CORE_HOST_ALLOWLIST allowlist de hostnames (fail-closed)
//
// Testável via node:test com fetchImpl injetado (padrão da squad operacao).

export const NGV_CORE_TIMEOUT_MS = 10_000;
export const NGV_CORE_MAX_RESPONSE_BYTES = 64 * 1024;
export const NGV_CORE_PATH = "/functions/v1/banco-global-daily-ingest";

const MAX_COUNT = 1_000_000_000;

export class NgvCoreEmitterError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "NgvCoreEmitterError";
    this.code = code;
  }
}

/** @returns {never} */
function fail(code) {
  throw new NgvCoreEmitterError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hosts(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map((item) => item.toLowerCase());
  return String(value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function resolveNgvCoreConfig(options = {}) {
  const requestedTimeout = Number(options.timeoutMs ?? NGV_CORE_TIMEOUT_MS);
  return {
    url: options.url ?? process.env.NGV_CORE_URL ?? "",
    writerKey: options.writerKey ?? process.env.NGV_CORE_WRITER_KEY ?? "",
    hostAllowlist: options.hostAllowlist ?? process.env.NGV_CORE_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(requestedTimeout) ? Math.min(NGV_CORE_TIMEOUT_MS, Math.max(1, requestedTimeout)) : NGV_CORE_TIMEOUT_MS,
  };
}

export function validateNgvCoreUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw) fail("NGV_CORE_URL_INVALID");
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("NGV_CORE_URL_INVALID");
  }
  if (
    url.protocol !== "https:"
    || (url.port && url.port !== "443")
    || url.username || url.password
    || url.search || url.hash
    || url.pathname !== NGV_CORE_PATH
  ) fail("NGV_CORE_URL_INVALID");
  if (!hosts(allowlistedHosts).includes(url.hostname.toLowerCase())) fail("NGV_CORE_HOST_NOT_ALLOWLISTED");
  return url;
}

function iso(value) {
  return typeof value === "string" && value.length <= 64
    && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function count(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}

/** Normaliza a linha da query agregada (row de db.execute) para o aggregate canônico. */
export function normalizeAggregateRow(row) {
  if (!isPlainObject(row)) fail("AGGREGATE_INVALID");
  const offerTrackingCount = Number(row.offer_tracking_count);
  const metricsSnapshotCount = Number(row.metrics_snapshot_count);
  if (!Number.isSafeInteger(offerTrackingCount) || offerTrackingCount < 0) fail("AGGREGATE_INVALID");
  if (!Number.isSafeInteger(metricsSnapshotCount) || metricsSnapshotCount < 0) fail("AGGREGATE_INVALID");
  const toIso = (value) => {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };
  return {
    offer_tracking_count: offerTrackingCount,
    metrics_snapshot_count: metricsSnapshotCount,
    latest_metric_at: toIso(row.latest_metric_at),
    latest_offer_at: toIso(row.latest_offer_at),
  };
}

/** Monta o payload canônico do NGV Core. Sem PII. */
export function buildDailyPayload(aggregate, generatedAt = new Date().toISOString()) {
  if (!isPlainObject(aggregate) || !iso(generatedAt)) fail("AGGREGATE_INVALID");
  if (!count(aggregate.offer_tracking_count) || !count(aggregate.metrics_snapshot_count)) fail("AGGREGATE_INVALID");
  const latestMetricAt = aggregate.latest_metric_at ?? null;
  const latestOfferAt = aggregate.latest_offer_at ?? null;
  if (latestMetricAt !== null && !iso(latestMetricAt)) fail("AGGREGATE_INVALID");
  if (latestOfferAt !== null && !iso(latestOfferAt)) fail("AGGREGATE_INVALID");
  return {
    schema_version: 1,
    source: "banco-ngv",
    status: "ready",
    generated_at: generatedAt,
    offer_tracking_count: aggregate.offer_tracking_count,
    metrics_snapshot_count: aggregate.metrics_snapshot_count,
    latest_metric_at: latestMetricAt,
    latest_offer_at: latestOfferAt,
  };
}

async function readLimited(response, limit = NGV_CORE_MAX_RESPONSE_BYTES) {
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
    if (error instanceof NgvCoreEmitterError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Envia o agregado diário para o NGV Core.
 * - Fail-closed: WRITER_KEY ausente falha ANTES de banco/rede.
 * - POST com timeout de 10s, redirect manual, só 2xx = sucesso.
 * - Nunca registra apikey nem payload.
 */
export async function emitDailyIngest(aggregate, options = {}) {
  const config = resolveNgvCoreConfig(options.config);
  if (typeof config.writerKey !== "string" || !config.writerKey) fail("NGV_CORE_WRITER_KEY_MISSING");
  const url = validateNgvCoreUrl(config.url, config.hostAllowlist);
  const payload = buildDailyPayload(aggregate, options.generatedAt);
  const body = JSON.stringify(payload);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-ngv-core-key": config.writerKey,
      },
      body,
    });
    if (!response.ok) fail(`INGEST_REJECTED_${response.status}`);
    await readLimited(response, NGV_CORE_MAX_RESPONSE_BYTES);
    return {
      kind: "success",
      http_status: response.status,
      received_at: new Date().toISOString(),
      offer_tracking_count: payload.offer_tracking_count,
      metrics_snapshot_count: payload.metrics_snapshot_count,
      latest_metric_at: payload.latest_metric_at,
      latest_offer_at: payload.latest_offer_at,
    };
  } catch (error) {
    if (error instanceof NgvCoreEmitterError) throw error;
    if (error?.name === "AbortError") fail("NGV_CORE_TIMEOUT");
    fail("NGV_CORE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

export const emitNgvCoreDailyIngest = emitDailyIngest;
