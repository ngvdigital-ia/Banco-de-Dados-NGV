import { isIP } from "node:net";

export const NGV_CORE_COMMERCE_SUMMARY_TIMEOUT_MS = 3_000;
export const MAX_NGV_CORE_COMMERCE_SUMMARY_BYTES = 64 * 1024;
export const MAX_NGV_CORE_COMMERCE_OFFERS = 200;
export const MAX_NGV_CORE_COMMERCE_FRESHNESS_MS = 5 * 60 * 1000;
export const COMMERCE_STATES = Object.freeze([
  "SOURCE_STALE",
  "PENDING_MAPPING",
  "EXTERNAL",
  "QUARANTINED",
  "ACCESS_MISSING",
  "READBACK_OBSERVED",
  "SALE_OBSERVED",
  "PENDING_SALE",
]);
export const COMMERCE_METRICS = Object.freeze([
  "catalog_product_count",
  "mapped_product_count",
  "sale_count",
  "active_access_count",
  "quarantine_count",
  "readback_count",
]);

const CANONICAL_OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_MILLIS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class NgvCoreCommerceSummaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "NgvCoreCommerceSummaryError";
    this.code = code;
  }
}

const fail = (code) => { throw new NgvCoreCommerceSummaryError(code); };

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]);
}

function isPositiveSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIsoMillisUtc(value) {
  return typeof value === "string" && value.length === 24 && ISO_MILLIS_UTC.test(value)
    && Number.isFinite(Date.parse(value));
}

function isPublicIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const split = normalized.split("::");
  if (split.length > 2) return false;
  const left = split[0] ? split[0].split(":") : [];
  const right = split[1] ? split[1].split(":") : [];
  const parts = normalized.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return false;
  const values = parts.map((part) => Number.parseInt(part, 16));
  const mapped = values.slice(0, 5).every((value) => value === 0) && (values[5] === 0 || values[5] === 0xffff);
  if (mapped) return isPublicIpv4(`${values[6] >> 8}.${values[6] & 255}.${values[7] >> 8}.${values[7] & 255}`);
  const first = values[0];
  return !(
    first === 0 || (first >= 0xfe80 && first <= 0xfebf) || (first >= 0xfc00 && first <= 0xfdff)
    || first >= 0xff00 || (values[0] === 0x2001 && values[1] === 0x0db8)
  );
}

function isPublicHostname(hostname) {
  const normalized = hostname.toLowerCase();
  const ipVersion = isIP(normalized.replace(/^\[|\]$/g, ""));
  if (ipVersion === 4) return isPublicIpv4(normalized);
  if (ipVersion === 6) return isPublicIpv6(normalized);
  if (normalized.length > 253 || !normalized.includes(".")) return false;
  const labels = normalized.split(".");
  const tld = labels.at(-1);
  if (!tld || ["local", "localhost", "internal", "test", "invalid", "example"].includes(tld) || !/^[a-z]+$/i.test(tld)) return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function allowedHostnames(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean));
}

export function validateNgvCoreCommerceSummaryUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw || /\s/.test(raw)) fail("SUMMARY_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("SUMMARY_URL_INVALID"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash
    || (url.port && url.port !== "443") || !isPublicHostname(url.hostname)) fail("SUMMARY_URL_INVALID");
  if (url.pathname !== "/functions/v1/offer-commerce-summary-read") fail("SUMMARY_URL_INVALID");
  if (!allowedHostnames(allowlistedHosts).has(url.hostname.toLowerCase())) fail("SUMMARY_HOST_NOT_ALLOWLISTED");
  return url;
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? NGV_CORE_COMMERCE_SUMMARY_TIMEOUT_MS);
  return {
    enabled: options.enabled ?? process.env.OPERATION_COMMERCE_READBACK_ENABLED ?? false,
    url: options.url ?? process.env.NGV_CORE_COMMERCE_SUMMARY_URL ?? "",
    readerKey: options.readerKey ?? process.env.NGV_CORE_COMMERCE_SUMMARY_READER_KEY ?? "",
    allowedHosts: options.allowedHosts ?? process.env.NGV_CORE_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(timeout)
      ? Math.min(NGV_CORE_COMMERCE_SUMMARY_TIMEOUT_MS, Math.max(1, timeout))
      : NGV_CORE_COMMERCE_SUMMARY_TIMEOUT_MS,
  };
}

function safeNow(value) {
  const now = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(now.valueOf()) ? now : new Date();
}

async function readResponse(response) {
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
      if (total > MAX_NGV_CORE_COMMERCE_SUMMARY_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof NgvCoreCommerceSummaryError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function parseMetrics(value) {
  if (!isPlainObject(value) || !exactKeys(value, COMMERCE_METRICS) || !COMMERCE_METRICS.every((metric) => isNonNegativeSafeInteger(value[metric]))) fail("RESPONSE_SCHEMA_INVALID");
  const metrics = Object.fromEntries(COMMERCE_METRICS.map((metric) => [metric, value[metric]]));
  // All following relations are derivable from the aggregate contract. Do not
  // invent stronger relations: access/readback can legitimately outnumber sales.
  if (metrics.mapped_product_count > metrics.catalog_product_count) fail("RESPONSE_SCHEMA_INVALID");
  return metrics;
}

function stateMatchesMetrics(state, metrics) {
  if (state === "PENDING_MAPPING") return metrics.mapped_product_count < metrics.catalog_product_count;
  if (state === "EXTERNAL") return metrics.catalog_product_count > 0 && metrics.mapped_product_count === metrics.catalog_product_count;
  if (state === "QUARANTINED") return metrics.quarantine_count > 0;
  if (state === "ACCESS_MISSING") return metrics.sale_count > 0 && metrics.readback_count === 0;
  if (state === "READBACK_OBSERVED") return metrics.readback_count > 0;
  if (state === "SALE_OBSERVED") return metrics.sale_count > 0;
  if (state === "PENDING_SALE") return metrics.sale_count === 0 && metrics.readback_count === 0;
  return true; // SOURCE_STALE intentionally suppresses semantic interpretation.
}

function parseOffer(value) {
  if (!isPlainObject(value) || !exactKeys(value, ["banco_offer_tracking_id", "state", "metrics"])
    || !isPositiveSafeInteger(value.banco_offer_tracking_id) || !COMMERCE_STATES.includes(value.state)) fail("RESPONSE_SCHEMA_INVALID");
  const metrics = parseMetrics(value.metrics);
  if (!stateMatchesMetrics(value.state, metrics)) fail("RESPONSE_SCHEMA_INVALID");
  return { banco_offer_tracking_id: value.banco_offer_tracking_id, state: value.state, metrics };
}

export function normalizeNgvCoreCommerceSummary(body, { now } = {}) {
  if (!isPlainObject(body) || !exactKeys(body, ["schema_version", "source", "generated_at", "offers"])
    || body.schema_version !== 1 || body.source !== "ngv-core-commerce" || !Array.isArray(body.offers)
    || body.offers.length > MAX_NGV_CORE_COMMERCE_OFFERS) fail("RESPONSE_SCHEMA_INVALID");
  if (!isIsoMillisUtc(body.generated_at)) fail("RESPONSE_SCHEMA_INVALID");
  if (Math.abs(Date.parse(body.generated_at) - safeNow(now).valueOf()) > MAX_NGV_CORE_COMMERCE_FRESHNESS_MS) fail("SUMMARY_STALE");
  const offers = body.offers.map(parseOffer);
  const seen = new Set();
  for (const offer of offers) {
    if (seen.has(offer.banco_offer_tracking_id)) fail("RESPONSE_SCHEMA_INVALID");
    seen.add(offer.banco_offer_tracking_id);
  }
  return { kind: "success", source: "ngv-core-commerce", generated_at: body.generated_at, offers };
}

function unavailable(code = "SUMMARY_UNAVAILABLE") {
  return { kind: "unavailable", source: "UNAVAILABLE", code, generated_at: null, offers: [] };
}

export function emptyNgvCoreCommerceSummary() {
  return { kind: "disabled", source: "UNVERIFIED", code: "SUMMARY_DISABLED", generated_at: null, offers: [] };
}

export async function fetchNgvCoreCommerceSummary(options = {}) {
  const config = configFrom(options.config);
  if (config.enabled !== true && config.enabled !== "true") return emptyNgvCoreCommerceSummary();
  try {
    const url = validateNgvCoreCommerceSummaryUrl(config.url, config.allowedHosts);
    if (typeof config.readerKey !== "string" || !config.readerKey) fail("READER_KEY_MISSING");
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-ngv-core-key": config.readerKey },
        body: JSON.stringify({ schema_version: 1 }),
      });
      if (!response.ok) return unavailable(response.status >= 400 && response.status < 500 ? "SUMMARY_REQUEST_INVALID" : "SUMMARY_UNAVAILABLE");
      if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return unavailable("RESPONSE_MEDIA_TYPE_INVALID");
      let body;
      try { body = JSON.parse(await readResponse(response)); } catch (error) { if (error instanceof NgvCoreCommerceSummaryError) throw error; fail("RESPONSE_JSON_INVALID"); }
      return normalizeNgvCoreCommerceSummary(body, { now: options.now });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof NgvCoreCommerceSummaryError) return unavailable(error.code);
    return unavailable(error?.name === "AbortError" ? "SUMMARY_TIMEOUT" : "SUMMARY_UNAVAILABLE");
  }
}

function pendingMetrics() {
  return Object.fromEntries(COMMERCE_METRICS.map((metric) => [metric, 0]));
}

function validCanonicalOfferId(value) {
  return typeof value === "string" && CANONICAL_OFFER_ID.test(value);
}

function countByState(records) {
  const counts = { SOURCE_STALE: 0, PENDING_MAPPING: 0, EXTERNAL: 0, QUARANTINED: 0, ACCESS_MISSING: 0, READBACK_OBSERVED: 0, SALE_OBSERVED: 0, PENDING_SALE: 0, PENDING: 0, DIVERGENT: 0 };
  for (const record of records) counts[record.state] += 1;
  return counts;
}

/**
 * The Core contract intentionally contains only Banco numeric IDs. A numeric
 * match is accepted only when the local row has a valid canonical identity;
 * names, site URLs and product labels are never used as fallback evidence.
 */
export function projectNgvCoreCommerceReadback(bancoOffers, summary) {
  const rows = Array.isArray(bancoOffers) ? bancoOffers : [];
  const idCounts = new Map();
  const canonicalCounts = new Map();
  for (const row of rows) {
    if (isPositiveSafeInteger(row?.id)) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
    if (validCanonicalOfferId(row?.canonicalOfferId)) canonicalCounts.set(row.canonicalOfferId, (canonicalCounts.get(row.canonicalOfferId) ?? 0) + 1);
  }
  const coreByBancoId = new Map();
  if (summary?.kind === "success") for (const offer of summary.offers) coreByBancoId.set(offer.banco_offer_tracking_id, offer);
  const records = rows.flatMap((row) => {
    if (!isPositiveSafeInteger(row?.id)) return [];
    const base = { offerTrackingId: row.id, metrics: pendingMetrics() };
    if (!validCanonicalOfferId(row.canonicalOfferId)) return [{ ...base, identityState: "IDENTITY_PENDING", state: "PENDING" }];
    if (idCounts.get(row.id) !== 1 || canonicalCounts.get(row.canonicalOfferId) !== 1) return [{ ...base, identityState: "DIVERGENT", state: "DIVERGENT" }];
    if (summary?.kind !== "success") return [{ ...base, identityState: "CONFIRMED", state: "PENDING" }];
    const coreOffer = coreByBancoId.get(row.id) ?? null;
    if (!coreOffer) return [{ ...base, identityState: "CONFIRMED", state: "PENDING" }];
    return [{ ...base, identityState: "CONFIRMED", state: coreOffer.state, metrics: { ...coreOffer.metrics } }];
  });
  return {
    source: "ngv-core-commerce",
    sourceFreshness: summary?.kind === "success" ? { state: "OBSERVED", generatedAt: summary.generated_at } : { state: "UNAVAILABLE", generatedAt: null },
    records,
    counts: countByState(records),
  };
}

export const getNgvCoreCommerceSummary = fetchNgvCoreCommerceSummary;
