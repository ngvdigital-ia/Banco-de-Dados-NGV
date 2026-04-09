// Shared team sigla/name mappings used by offer-table and analytics

export const COPYWRITERS = ["DG", "GF", "GL", "RO", "MALU", "VA", "CA", "LF"];
export const EDITORS = ["DG", "GF", "GL", "RO", "MALU", "VA", "CA", "LF"];
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
  DG: "Diogo", GF: "Gabriel Fischer", GL: "Gabriel Lima", GA: "Gabriel Fischer", RO: "Robert",
  MALU: "Malu", VA: "Victor Andrade", CA: "Camile", LF: "Luis Felipe",
  ICARO: "Icaro", LUIZA: "Luiza",
};

export const NAME_TO_SIGLA: Record<string, string> = {
  dg: "DG", gf: "GF", gl: "GL", ga: "GF", ro: "RO", malu: "MALU", va: "VA", ca: "CA", lf: "LF",
  icaro: "ICARO", luiza: "LUIZA",
  diogo: "DG",
  gabriel: "GF", "gabriel fischer": "GF", "gabriel backes fischer": "GF", fischer: "GF",
  "gabriel lima": "GL", lima: "GL",
  robert: "RO", "robert oliveira": "RO",
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
 * Check if a multi-person field (e.g. "RO & GF") contains a specific sigla.
 */
export function fieldContainsSigla(field: string | null, sigla: string): boolean {
  if (!field) return false;
  return field.split(/\s*&\s*/).some((part) => part.trim().toUpperCase() === sigla.toUpperCase());
}
