import { isIP } from "node:net";

export const NGV_CORE_LIFECYCLE_SUMMARY_TIMEOUT_MS = 3_000;
export const MAX_NGV_CORE_LIFECYCLE_SUMMARY_BYTES = 256 * 1024;
export const MAX_NGV_CORE_LIFECYCLE_OFFERS = 500;
export const MAX_NGV_CORE_LIFECYCLE_FRESHNESS_MS = 5 * 60 * 1000;
export const LIFECYCLE_FACETS = Object.freeze([
  "scope",
  "local",
  "visual",
  "public_url",
  "checkout",
  "tracking",
  "production",
]);

const OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_MILLIS_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SUMMARY_STATES = Object.freeze(["PASS", "FAIL", "PENDING", "STALE"]);

export class NgvCoreLifecycleSummaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "NgvCoreLifecycleSummaryError";
    this.code = code;
  }
}

const fail = (code) => { throw new NgvCoreLifecycleSummaryError(code); };

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

function isIsoMillisUtc(value) {
  return typeof value === "string" && value.length === 24 && ISO_MILLIS_UTC.test(value)
    && Number.isFinite(Date.parse(value));
}

function isPositiveSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSummaryState(value) {
  return typeof value === "string" && SUMMARY_STATES.includes(value);
}

function aggregateFacetState(facets) {
  const states = LIFECYCLE_FACETS.map((facet) => facets[facet].state);
  if (states.includes("FAIL")) return "FAIL";
  if (states.includes("STALE")) return "STALE";
  if (states.includes("PENDING")) return "PENDING";
  return "PASS";
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
  const hextets = normalized.split("::");
  if (hextets.length > 2) return false;
  const explicit = normalized.includes("::")
    ? [...(hextets[0] ? hextets[0].split(":") : []), ...Array(8 - (hextets[0] ? hextets[0].split(":").length : 0) - (hextets[1] ? hextets[1].split(":").length : 0)).fill("0"), ...(hextets[1] ? hextets[1].split(":") : [])]
    : normalized.split(":");
  if (explicit.length !== 8 || explicit.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return false;
  const values = explicit.map((part) => Number.parseInt(part, 16));
  const first = values[0];
  const isIpv4Mapped = values.slice(0, 5).every((value) => value === 0) && (values[5] === 0 || values[5] === 0xffff);
  if (isIpv4Mapped) {
    const ipv4 = `${values[6] >> 8}.${values[6] & 255}.${values[7] >> 8}.${values[7] & 255}`;
    return isPublicIpv4(ipv4);
  }
  if ((first >= 0xfe80 && first <= 0xfebf) // RFC 4291 link-local fe80::/10
    || first === 0 || first === 0xfc00 || first === 0xfd00
    || (first >= 0xfc00 && first <= 0xfdff) || first >= 0xff00
    || (values[0] === 0x2001 && values[1] === 0x0db8)) return false;
  return true;
}

function isPublicHostname(hostname) {
  const normalized = hostname.toLowerCase();
  const ipVersion = isIP(normalized.replace(/^\[|\]$/g, ""));
  if (ipVersion === 4) return isPublicIpv4(normalized);
  if (ipVersion === 6) return isPublicIpv6(normalized);
  if (normalized.length > 253 || !normalized.includes(".")) return false;
  const labels = normalized.split(".");
  const reservedSuffixes = ["local", "localhost", "internal", "test", "invalid", "example"];
  const tld = labels.at(-1);
  if (!tld || reservedSuffixes.includes(tld) || !/^[a-z]+$/i.test(tld)) return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function allowedHostnames(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean));
}

export function validateNgvCoreLifecycleSummaryUrl(raw, allowlistedHosts) {
  if (typeof raw !== "string" || !raw || /\s/.test(raw)) fail("SUMMARY_URL_INVALID");
  let url;
  try { url = new URL(raw); } catch { fail("SUMMARY_URL_INVALID"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash
    || (url.port && url.port !== "443") || !isPublicHostname(url.hostname)) fail("SUMMARY_URL_INVALID");
  if (url.pathname !== "/functions/v1/offer-lifecycle-summary-read") fail("SUMMARY_URL_INVALID");
  if (!allowedHostnames(allowlistedHosts).has(url.hostname.toLowerCase())) fail("SUMMARY_HOST_NOT_ALLOWLISTED");
  return url;
}

function configFrom(options = {}) {
  const timeout = Number(options.timeoutMs ?? NGV_CORE_LIFECYCLE_SUMMARY_TIMEOUT_MS);
  return {
    enabled: options.enabled ?? process.env.OPERATION_LIFECYCLE_EVIDENCE_ENABLED ?? false,
    url: options.url ?? process.env.NGV_CORE_LIFECYCLE_SUMMARY_URL ?? "",
    readerKey: options.readerKey ?? process.env.NGV_CORE_LIFECYCLE_READER_KEY ?? "",
    allowedHosts: options.allowedHosts ?? process.env.NGV_CORE_HOST_ALLOWLIST ?? "",
    timeoutMs: Number.isFinite(timeout)
      ? Math.min(NGV_CORE_LIFECYCLE_SUMMARY_TIMEOUT_MS, Math.max(1, timeout))
      : NGV_CORE_LIFECYCLE_SUMMARY_TIMEOUT_MS,
  };
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
      if (total > MAX_NGV_CORE_LIFECYCLE_SUMMARY_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof NgvCoreLifecycleSummaryError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(output);
}

function parseFacet(value) {
  if (!isPlainObject(value) || !exactKeys(value, ["state", "observed_at"])
    || !isSummaryState(value.state)
    || !(value.observed_at === null || isIsoMillisUtc(value.observed_at))) fail("RESPONSE_SCHEMA_INVALID");
  return { state: value.state, observed_at: value.observed_at };
}

function parseOffer(value) {
  if (!isPlainObject(value) || !exactKeys(value, ["offer_id", "banco_offer_tracking_id", "state", "facets"])
    || typeof value.offer_id !== "string" || !OFFER_ID.test(value.offer_id)
    || !isPositiveSafeInteger(value.banco_offer_tracking_id) || !isSummaryState(value.state)
    || !isPlainObject(value.facets) || !exactKeys(value.facets, LIFECYCLE_FACETS)) fail("RESPONSE_SCHEMA_INVALID");
  const facets = Object.fromEntries(LIFECYCLE_FACETS.map((facet) => [facet, parseFacet(value.facets[facet])]));
  if (value.state !== aggregateFacetState(facets)) fail("RESPONSE_SCHEMA_INVALID");
  return {
    offer_id: value.offer_id,
    banco_offer_tracking_id: value.banco_offer_tracking_id,
    state: value.state,
    facets,
  };
}

function safeNow(value) {
  const now = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(now.valueOf()) ? now : new Date();
}

function validateGeneratedAt(value, now) {
  if (!isIsoMillisUtc(value)) fail("RESPONSE_SCHEMA_INVALID");
  if (Math.abs(Date.parse(value) - now.valueOf()) > MAX_NGV_CORE_LIFECYCLE_FRESHNESS_MS) fail("SUMMARY_STALE");
}

export function normalizeNgvCoreLifecycleSummary(body, { now } = {}) {
  if (!isPlainObject(body) || !exactKeys(body, ["schema_version", "source", "generated_at", "offers"])
    || body.schema_version !== 1 || body.source !== "ngv-core-lifecycle"
    || !Array.isArray(body.offers)
    || body.offers.length > MAX_NGV_CORE_LIFECYCLE_OFFERS) fail("RESPONSE_SCHEMA_INVALID");
  validateGeneratedAt(body.generated_at, safeNow(now));
  const offers = body.offers.map(parseOffer);
  const offerIds = new Set();
  const bancoIds = new Set();
  for (const offer of offers) {
    if (offerIds.has(offer.offer_id) || bancoIds.has(offer.banco_offer_tracking_id)) fail("RESPONSE_SCHEMA_INVALID");
    offerIds.add(offer.offer_id);
    bancoIds.add(offer.banco_offer_tracking_id);
  }
  return {
    kind: "success",
    source: "ngv-core-lifecycle",
    generated_at: body.generated_at,
    offers,
  };
}

function unavailable(code = "SUMMARY_UNAVAILABLE") {
  return { kind: "unavailable", source: "UNAVAILABLE", code, generated_at: null, offers: [] };
}

export function emptyNgvCoreLifecycleSummary() {
  return { kind: "disabled", source: "UNVERIFIED", code: "SUMMARY_DISABLED", generated_at: null, offers: [] };
}

export async function fetchNgvCoreLifecycleSummary(options = {}) {
  const config = configFrom(options.config);
  if (config.enabled !== true && config.enabled !== "true") return emptyNgvCoreLifecycleSummary();
  try {
    const url = validateNgvCoreLifecycleSummaryUrl(config.url, config.allowedHosts);
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
        headers: {
          "content-type": "application/json",
          "x-ngv-core-key": config.readerKey,
        },
        body: JSON.stringify({ schema_version: 1 }),
      });
      if (!response.ok) return unavailable(response.status >= 400 && response.status < 500 ? "SUMMARY_REQUEST_INVALID" : "SUMMARY_UNAVAILABLE");
      if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
        return unavailable("RESPONSE_MEDIA_TYPE_INVALID");
      }
      let body;
      try { body = JSON.parse(await readResponse(response)); } catch (error) { if (error instanceof NgvCoreLifecycleSummaryError) throw error; fail("RESPONSE_JSON_INVALID"); }
      return normalizeNgvCoreLifecycleSummary(body, { now: options.now });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof NgvCoreLifecycleSummaryError) return unavailable(error.code);
    return unavailable(error?.name === "AbortError" ? "SUMMARY_TIMEOUT" : "SUMMARY_UNAVAILABLE");
  }
}

function validCanonicalOfferId(value) {
  return typeof value === "string" && OFFER_ID.test(value);
}

function pendingFacets() {
  return Object.fromEntries(LIFECYCLE_FACETS.map((facet) => [facet, { state: "PENDING", observed_at: null }]));
}

function outputFacets(facets) {
  return Object.fromEntries(LIFECYCLE_FACETS.map((facet) => [facet, {
    state: facets[facet].state,
    observedAt: facets[facet].observed_at,
  }]));
}

function countByState(records) {
  const counts = { PASS: 0, FAIL: 0, PENDING: 0, STALE: 0, DIVERGENT: 0 };
  for (const record of records) counts[record.state] += 1;
  return counts;
}

/**
 * Reconciles only stable IDs. Names and local URLs are deliberately absent:
 * matching either would turn an inference into lifecycle evidence.
 */
export function projectNgvCoreLifecycleEvidence(bancoOffers, summary) {
  const rows = Array.isArray(bancoOffers) ? bancoOffers : [];
  const canonicalCounts = new Map();
  for (const row of rows) {
    if (!validCanonicalOfferId(row?.canonicalOfferId)) continue;
    canonicalCounts.set(row.canonicalOfferId, (canonicalCounts.get(row.canonicalOfferId) ?? 0) + 1);
  }
  const coreByOfferId = new Map();
  const coreByBancoId = new Map();
  if (summary?.kind === "success") {
    for (const coreOffer of summary.offers) {
      coreByOfferId.set(coreOffer.offer_id, coreOffer);
      coreByBancoId.set(coreOffer.banco_offer_tracking_id, coreOffer);
    }
  }

  const records = rows.flatMap((row) => {
    if (!isPositiveSafeInteger(row?.id)) return [];
    const canonicalOfferId = validCanonicalOfferId(row.canonicalOfferId) ? row.canonicalOfferId : null;
    const base = {
      offerTrackingId: row.id,
      offerId: canonicalOfferId ?? "PENDING",
      facets: outputFacets(pendingFacets()),
    };
    if (!canonicalOfferId) {
      return [{ ...base, identityState: "IDENTITY_PENDING", state: "PENDING" }];
    }
    if (canonicalCounts.get(canonicalOfferId) !== 1) {
      return [{ ...base, identityState: "DIVERGENT", state: "DIVERGENT" }];
    }
    if (summary?.kind !== "success") {
      return [{ ...base, identityState: "CONFIRMED", state: "PENDING" }];
    }
    const byCanonical = coreByOfferId.get(canonicalOfferId) ?? null;
    const byBancoId = coreByBancoId.get(row.id) ?? null;
    if (!byCanonical && !byBancoId) {
      return [{ ...base, identityState: "CONFIRMED", state: "PENDING" }];
    }
    if (!byCanonical || !byBancoId || byCanonical !== byBancoId
      || byCanonical.offer_id !== canonicalOfferId || byCanonical.banco_offer_tracking_id !== row.id) {
      return [{ ...base, identityState: "DIVERGENT", state: "DIVERGENT" }];
    }
    return [{
      ...base,
      identityState: "CONFIRMED",
      state: byCanonical.state,
      facets: outputFacets(byCanonical.facets),
    }];
  });

  return {
    source: "ngv-core-lifecycle",
    sourceFreshness: summary?.kind === "success"
      ? { state: "OBSERVED", generatedAt: summary.generated_at }
      : { state: "UNAVAILABLE", generatedAt: null },
    records,
    counts: countByState(records),
  };
}

export const getNgvCoreLifecycleSummary = fetchNgvCoreLifecycleSummary;
