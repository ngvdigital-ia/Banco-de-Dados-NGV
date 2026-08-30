// Normaliza somente a evidência agregada já lida do NGV Core para a mesa do
// cockpit. Não consulta rede, banco, nem altera as fontes. O rollback é a flag
// server-side OPERATION_CORE_SOURCE_STATE_ENABLED.

/** @typedef {"OPERANT" | "DEGRADED" | "UNAVAILABLE" | "UNVERIFIED"} CoreSourceState */
/** @typedef {{ id: string, label: string, state: CoreSourceState, coverage: string, detail: string, last_read_at: string | null }} CoreOperationSource */

export const CORE_OPERATION_SOURCES = Object.freeze([
  { key: "spy", id: "core-spy", label: "Spy · Core" },
  { key: "nexfy", id: "core-nexfy", label: "Nexfy · Core" },
  { key: "banco_ngv", id: "core-banco-ngv", label: "Banco NGV · Core" },
  { key: "quiz_analytics", id: "core-quiz", label: "Quiz · Core" },
  { key: "apps_ofertas", id: "core-apps", label: "Apps Ofertas · Core" },
  { key: "plataforma_cursos", id: "core-cursos", label: "Cursos · Core" },
  { key: "monitoramento_ngv", id: "core-monitoramento-ngv", label: "Monitoramento · Core" },
]);

/** @returns {CoreOperationSource} */
function disabledOrUnavailable(summary) {
  if (summary?.kind === "unavailable") {
    return {
      id: "ngv-core",
      label: "NGV Core",
      state: "UNAVAILABLE",
      coverage: "7 fontes",
      detail: "Leitura do resumo agregado central indisponível; fontes locais foram preservadas.",
      last_read_at: null,
    };
  }
  return {
    id: "ngv-core",
    label: "NGV Core",
    state: "UNVERIFIED",
    coverage: "7 fontes",
    detail: "Leitura do resumo agregado central não habilitada neste ambiente.",
    last_read_at: null,
  };
}

/** @returns {CoreOperationSource[]} */
export function coreSourceStates(summary, { enabled = false } = {}) {
  if (enabled !== true) return [];
  if (summary?.kind !== "success") return [disabledOrUnavailable(summary)];

  return CORE_OPERATION_SOURCES.map(({ key, id, label }) => {
    const source = summary.sources?.[key] ?? null;
    const freshness = summary.freshness?.by_source?.[key] ?? null;
    if (!source) {
      return {
        id,
        label,
        state: "UNVERIFIED",
        coverage: "PENDING",
        detail: "O Core não recebeu um resumo agregado desta fonte.",
        last_read_at: null,
      };
    }
    if (!freshness) {
      return {
        id,
        label,
        state: "UNVERIFIED",
        coverage: "Core · resumo agregado",
        detail: "O Core recebeu o resumo agregado, mas não informou a idade dessa leitura.",
        last_read_at: source.generated_at ?? null,
      };
    }
    return {
      id,
      label,
      state: freshness.is_stale ? "DEGRADED" : "OPERANT",
      coverage: "Core · resumo agregado",
      detail: freshness.is_stale
        ? `Resumo agregado do Core antigo (${freshness.age_hours} h).`
        : `Leitura recente do resumo agregado no Core (${freshness.age_hours} h).`,
      last_read_at: freshness.generated_at ?? source.generated_at ?? null,
    };
  });
}

/** @param {CoreOperationSource[]} sources */
export function coreSourceStatesHaveStaleEvidence(sources) {
  return Array.isArray(sources) && sources.some((source) => source?.state === "DEGRADED");
}
