export const RECENT_OFFERS_LIMIT = 200;
export const ROLLING_WINDOW_DAYS = 30;
export const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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
    const phase = phaseForOffer(row);

    return {
      offer_id: `banco:${row.id}`,
      offer_slug: `banco-${row.id}`,
      display_name: row.name,
      language: row.language,
      phase,
      state: stateForPhase(phase),
      blockers: [],
      last_evidence_at: iso(row.updatedAt ?? row.createdAt),
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
