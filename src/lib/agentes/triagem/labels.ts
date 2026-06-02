/**
 * labels.ts — Rótulos pt-BR dos valores de classificação de candidatos da triagem.
 *
 * Extraído de CandidatosTable.tsx pra ser reutilizado em CandidatoDetailsSheet.tsx
 * e em qualquer outro componente que exiba classificação de candidatos.
 */

/** Mapa de classificação (enum UPPER_SNAKE) → rótulo legível pt-BR */
export const classifLabels: Record<string, string> = {
  MUITO_BOM: "Muito bom",
  TALVEZ: "Talvez",
  DESCARTAR: "Descartar",
};

/** Retorna o rótulo legível da classificação, com fallback pro próprio valor. */
export function classifLabel(c: string): string {
  return classifLabels[c] ?? c;
}

/** Retorna as classes Tailwind de cor do badge de classificação. */
export function classifBadgeColor(c: string): string {
  if (c === "MUITO_BOM")
    return "bg-success-muted text-success-muted-foreground hover:bg-success-muted";
  if (c === "TALVEZ")
    return "bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted";
  if (c === "DESCARTAR") return "bg-muted text-muted-foreground hover:bg-muted";
  return "bg-muted text-muted-foreground";
}
