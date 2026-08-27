export const RECENT_OFFERS_LIMIT = 200;
export const ROLLING_WINDOW_DAYS = 30;
export const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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

export function projectRecentOffers(rows, now = new Date()) {
  const generatedAt = iso(now);
  const offers = rows.map((row) => {
    const dbPhase = phaseForOffer(row);
    const phase = dbPhase;
    const offerId = `banco:${row.id}`;
    const offerSlug = `banco-${row.id}`;
    const displayName = row.name;
    const dbEvidence = {
      source: "banco-ngv",
      external_id: String(row.id),
      relation: "offer_tracking",
      state: `phase:${dbPhase}`,
      observed_at: iso(row.updatedAt ?? row.createdAt),
    };
    const state = stateForPhase(dbPhase);
    const evidence = [dbEvidence];

    return {
      offer_id: offerId,
      offer_slug: offerSlug,
      display_name: displayName,
      language: row.language,
      phase,
      state,
      source_of_truth: "banco-ngv",
      external_ids: {
        banco_ngv: [String(row.id)], clickup: [], n8n: [], pages: [], product: [], metrics: [],
      },
      reconciliation: {
        status: "PENDING",
        evidence: [],
      },
      source_status: `phase:${phase}`,
      aggregated_status: state,
      next_owner: "PENDING",
      evidence,
      metric_binding: structuredClone(PENDING_METRIC_BINDING),
      blockers: [],
      last_evidence_at: dbEvidence.observed_at,
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
      label: "Banco NGV · Neon",
      state: "OPERANT",
      coverage: `${offers.length} ofertas recentes`,
      detail: "Autoridade de ofertas e métricas; consulta read-only em offer_tracking.",
      last_read_at: generatedAt,
    }],
    events: [],
  };
}
