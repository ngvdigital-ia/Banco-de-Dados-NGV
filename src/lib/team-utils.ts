// Shared team sigla/name mappings used by offer-table and analytics

// 2026-06-12: VA (Victor Andrade) e CA (Camile) saíram da equipe — removidos das
// OPÇÕES (selects/popup). Os mapeamentos deles ficam abaixo pro HISTÓRICO continuar
// atribuível. RO agora é Romulo (uso real do time; Robert é marcado como "ROBERT").
export const COPYWRITERS = ["DG", "GF", "GL", "RO", "MALU", "LF"];
export const EDITORS = ["DG", "GF", "GL", "RO", "MALU", "LF"];
export const LANGUAGES = ["EN", "FR", "DE", "ITA", "ES", "PT"];

export const AD_FORMATS = [
  "especialista",
  "ugc_masc",
  "ugc_fem",
  "famoso",
  "youtuber",
  "autoridade",
  "podcast",
] as const;

export const FORMAT_LABELS: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masculino",
  ugc_fem: "UGC Feminino",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
};

export const SIGLA_TO_NAME: Record<string, string> = {
  DG: "Diogo", GF: "Gabriel Fischer", GL: "Gabriel Lima", GA: "Gabriel Fischer", RO: "Romulo",
  MALU: "Malu", VA: "Victor Andrade", CA: "Camile", LF: "Luis Felipe",
  ICARO: "Icaro", LUIZA: "Luiza",
};

export const NAME_TO_SIGLA: Record<string, string> = {
  dg: "DG", gf: "GF", gl: "GL", ga: "GF", ro: "RO", malu: "MALU", va: "VA", ca: "CA", lf: "LF",
  icaro: "ICARO", luiza: "LUIZA",
  diogo: "DG",
  gabriel: "GF", "gabriel fischer": "GF", "gabriel backes fischer": "GF", fischer: "GF",
  "gabriel lima": "GL", lima: "GL",
  // Robert NÃO tem sigla: os dados sempre o marcam como "ROBERT" (16 ofertas) — o
  // matching por nome (getMemberAliases) cobre. RO é o Romulo (uso real do time).
  romulo: "RO", "romulo santos": "RO",
  camile: "CA", camille: "CA",
  luis: "LF", "luis felipe": "LF",
  victor: "VA", "victor andrade": "VA",
  "maria luisa": "MALU", "maria luísa": "MALU",
};

/**
 * Get the sigla for a team member name (case-insensitive).
 * Returns the original name if no match found.
 */
export function getSigla(name: string): string {
  const sigla = NAME_TO_SIGLA[name.toLowerCase()];
  return sigla || name;
}

/**
 * Get the full name for a sigla.
 * Returns the sigla itself if no match found.
 */
export function getFullName(sigla: string): string {
  return SIGLA_TO_NAME[sigla] || sigla;
}

/**
 * Build all name variations for a team member (sigla, first name, full name).
 * Used to match against offer fields that may use any format.
 */
export function getMemberAliases(memberName: string): string[] {
  const firstName = memberName.split(" ")[0].toLowerCase();
  const fullName = memberName.toLowerCase();
  // IMPORTANT: check full name FIRST to avoid ambiguity (e.g., "gabriel" maps to GF but "gabriel lima" maps to GL)
  const sigla = NAME_TO_SIGLA[fullName] || NAME_TO_SIGLA[firstName] || "";

  const aliases = new Set<string>();
  if (sigla) aliases.add(sigla.toUpperCase());
  // Only add bare first name if it's not ambiguous (i.e., only one person has that first name)
  const isAmbiguousFirstName = firstName === "gabriel"; // Two Gabriels in team
  if (!isAmbiguousFirstName) {
    aliases.add(firstName.toUpperCase());
  }
  aliases.add(fullName.toUpperCase());

  // Also add SIGLA_TO_NAME reverse
  if (sigla && SIGLA_TO_NAME[sigla]) {
    aliases.add(SIGLA_TO_NAME[sigla].toUpperCase());
  }

  // Special cases for known name variations in the data
  if (firstName === "luis") aliases.add("LUIS FELIPE");
  if (firstName === "victor") aliases.add("VICTOR ANDRADE");
  if (fullName.includes("fischer")) { aliases.add("GABRIEL FISCHER"); aliases.add("GABRIEL"); }
  if (fullName.includes("lima")) aliases.add("GABRIEL LIMA");
  if (firstName === "malu" || fullName.includes("malu")) {
    aliases.add("MARIA LUISA");
    aliases.add("MARIA LUÍSA");
    aliases.add("MALU");
  }
  if (firstName === "camile") aliases.add("CAMILLE");

  return Array.from(aliases).filter(Boolean);
}

/**
 * Check if a field value (single or multi-person like "ROBERT & GABRIEL")
 * contains a reference to a specific team member.
 * Matches by sigla, first name, or full name.
 */
export function fieldContainsMember(field: string | null, memberName: string): boolean {
  if (!field) return false;
  const aliases = getMemberAliases(memberName);
  const parts = field.split(/\s*[&\-]\s*/).map((p) => p.trim().toUpperCase());
  return parts.some((part) => aliases.some((alias) => part === alias));
}

/**
 * Check if a single-value field matches a team member.
 */
export function fieldMatchesMember(field: string | null, memberName: string): boolean {
  if (!field) return false;
  const aliases = getMemberAliases(memberName);
  return aliases.some((alias) => field.trim().toUpperCase() === alias);
}
