import type { PeriodKey } from "./period.ts";

const FUNNEL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A URL só pode selecionar um projeto que veio da lista canônica do Quiz. Este
 * parser valida a forma; a página confirma a existência na lista antes de
 * fazer a leitura. Não existe fallback para uma oferta fixa.
 */
export function parseQuizFunnel(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  return value.length <= 120 && FUNNEL_SLUG.test(value) ? value : null;
}

export function buildQuizPeriodHref(period: PeriodKey, projectId: string): string {
  const query = new URLSearchParams({ project: projectId });
  if (period !== "today") query.set("period", period);
  return `/sistemas/quiz?${query.toString()}`;
}
