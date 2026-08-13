export const RECENT_OFFERS_LIMIT = 200;
export const ROLLING_WINDOW_DAYS = 30;
export const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const OPERATION_EVIDENCE_STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const STALE_EVIDENCE_DETAIL = "Evidência live com mais de 12 horas.";

const PENDING_METRIC_BINDING = {
  status: "PENDING",
  entity_type: null,
  entity_id: null,
  metric_ids: [],
  last_observed_at: null,
  detail: "Vínculo de métrica não mapeado por ID; nenhuma atribuição por nome foi feita.",
};

const PHASES = [
  { phase: 0, label: "Entrada" },
  { phase: 1, label: "Registrada" },
  { phase: 2, label: "Copy" },
  { phase: 3, label: "VTurb" },
  { phase: 4, label: "Site" },
  { phase: 5, label: "Produto" },
  { phase: 6, label: "Campanha" },
  { phase: 7, label: "Validação" },
];

function normalizedStatus(value) {
  return typeof value === "string"
    ? value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase()
    : "";
}

function isYes(value) {
  return normalizedStatus(value) === "SIM";
}

function isValidationComplete(value) {
  return ["SIM", "NAO DEU CERTO"].includes(normalizedStatus(value));
}

export function phaseForOffer(offer) {
  if (isValidationComplete(offer.validation)) return 7;
  if (isYes(offer.campaignsActive)) return 6;
  if (isYes(offer.productCreated) || isYes(offer.productApproved)) return 5;
  if (isYes(offer.siteCreated)) return 4;
  if (isYes(offer.vslInVturb)) return 3;
  if (isYes(offer.copyVslStatus) || isYes(offer.copyCriativosStatus)) return 2;
  return 1;
}

export function stateForPhase(phase) {
  if (phase === 1) return "PENDING";
  if (phase === 7) return "READY_FOR_REVIEW";
  return "IN_MOTION";
}

export async function captureReadOnlySnapshot(loader) {
  try {
    return { snapshot: await loader(), error: null };
  } catch (error) {
    return { snapshot: null, error };
  }
}

function iso(value) {
  return value.toISOString();
}

export function canonicalProjectionByBancoId(snapshot) {
  const projections = new Map();
  for (const offer of Array.isArray(snapshot?.offers) ? snapshot.offers : []) {
    const bancoIds = offer?.external_ids?.banco_ngv;
    if (!Array.isArray(bancoIds)) continue;
    for (const bancoId of bancoIds) {
      if (bancoId === null || bancoId === undefined) continue;
      const id = String(bancoId);
      if (!id || id === "PENDING") continue;
      if (projections.has(id)) throw new Error(`ID banco_ngv duplicado no snapshot: ${id}`);
      projections.set(id, offer);
    }
  }
  return projections;
}

export function projectCanonicalSources(snapshot, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (Array.isArray(snapshot?.sources) ? snapshot.sources : [])
    .filter((source) => source?.id === "clickup" || source?.id === "n8n")
    .map((source) => {
      const lastReadMs = typeof source.last_read_at === "string" ? Date.parse(source.last_read_at) : Number.NaN;
      const stale = Number.isFinite(nowMs) && Number.isFinite(lastReadMs)
        && nowMs - lastReadMs > OPERATION_EVIDENCE_STALE_AFTER_MS;
      return stale && source.state !== "UNAVAILABLE" && source.state !== "UNVERIFIED"
        ? { ...source, state: "DEGRADED", detail: STALE_EVIDENCE_DETAIL }
        : structuredClone(source);
    });
}

export function operationHasStaleEvidence(snapshot) {
  return (Array.isArray(snapshot?.sources) ? snapshot.sources : [])
    .some((source) => source?.detail === STALE_EVIDENCE_DETAIL);
}

function isClosedEvidenceState(value) {
  return new Set(["FINALIZADO", "FINALIZADA", "CONCLUIDO", "CONCLUIDA", "COMPLETE", "COMPLETED", "CLOSED"])
    .has(normalizedStatus(value));
}

function hasCanonicalOpenTask(canonical) {
  return (Array.isArray(canonical?.evidence) ? canonical.evidence : [])
    .some((item) => item?.source === "clickup" && !isClosedEvidenceState(item.state));
}

function latestIso(...values) {
  return values
    .filter((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))
    .map((value) => new Date(value).toISOString())
    .sort()
    .at(-1) ?? null;
}

/** @param {Map<string, object> | Record<string, object> | null} canonicalOffers */
export function projectRecentOffers(rows, now = new Date(), canonicalOffers = null) {
  const generatedAt = iso(now);
  const offers = rows.map((row) => {
    const dbPhase = phaseForOffer(row);
    const canonical = canonicalOffers?.get?.(String(row.id)) ?? canonicalOffers?.[String(row.id)] ?? null;
    const phase = Math.max(dbPhase, Number.isInteger(canonical?.phase) ? canonical.phase : 0);
    const offerId = canonical?.offer_id ?? `banco:${row.id}`;
    const offerSlug = canonical?.offer_slug ?? `banco-${row.id}`;
    const displayName = canonical?.display_name ?? row.name;
    const dbEvidence = {
      source: "banco-ngv",
      external_id: String(row.id),
      relation: "offer_tracking",
      state: `phase:${dbPhase}`,
      observed_at: iso(row.updatedAt ?? row.createdAt),
    };
    const canonicalState = canonical?.state ?? canonical?.aggregated_status;
    const canonicalBlockers = Array.isArray(canonical?.blockers) ? canonical.blockers : [];
    const canonicalHasBlockers = canonicalBlockers.length > 0;
    const canonicalStateIsReady = canonicalState === "READY_FOR_REVIEW"
      && !canonicalHasBlockers
      && !hasCanonicalOpenTask(canonical);
    const state = ["BLOCKED", "IN_MOTION", "ATTENTION"].includes(canonicalState)
      ? canonicalState
      : canonicalStateIsReady
        ? canonicalState
        : stateForPhase(dbPhase);
    const canonicalEvidence = Array.isArray(canonical?.evidence) ? structuredClone(canonical.evidence) : [];
    const evidence = [...canonicalEvidence, dbEvidence];
    const dbEvidenceAt = dbEvidence.observed_at;
    const canonicalEvidenceAt = [canonical?.last_evidence_at, ...canonicalEvidence.map((item) => item.observed_at)];

    return {
      ...(canonical ? structuredClone(canonical) : {}),
      offer_id: offerId,
      offer_slug: offerSlug,
      display_name: displayName,
      language: canonical?.language ?? row.language,
      phase,
      state,
      source_of_truth: "banco-ngv",
      external_ids: canonical?.external_ids ?? {
        banco_ngv: [String(row.id)], clickup: [], n8n: [], pages: [], product: [], metrics: [],
      },
      reconciliation: canonical?.reconciliation ?? {
        status: "PENDING",
        evidence: [],
      },
      source_status: canonical?.source_status ?? `phase:${phase}`,
      aggregated_status: state,
      next_owner: canonical?.next_owner ?? "PENDING",
      evidence,
      metric_binding: canonical?.metric_binding
        ? structuredClone(canonical.metric_binding)
        : structuredClone(PENDING_METRIC_BINDING),
      blockers: structuredClone(canonicalBlockers),
      last_evidence_at: latestIso(dbEvidenceAt, ...canonicalEvidenceAt),
    };
  });

  return {
    schema_version: 1,
    generated_at: generatedAt,
    source: "banco-ngv-runtime",
    mode: "read-only",
    phases: PHASES,
    offers,
    sources: [{
      id: "banco-ngv",
      label: "Banco NGV",
      state: "OPERANT",
      coverage: `${offers.length} ofertas recentes`,
      detail: "Consulta read-only em offer_tracking.",
      last_read_at: generatedAt,
    }],
    events: [],
  };
}
