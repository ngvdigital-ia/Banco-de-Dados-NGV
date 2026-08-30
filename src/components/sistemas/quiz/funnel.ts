import type { PeriodKey } from "./period.ts";

export const DEFAULT_QUIZ_FUNNEL = "roxyfox";

const FUNNEL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseQuizFunnel(value: string | undefined): string | null {
  if (value === undefined || value === "") return DEFAULT_QUIZ_FUNNEL;
  return value.length <= 120 && FUNNEL_SLUG.test(value) ? value : null;
}

export function buildQuizPeriodHref(period: PeriodKey, funnelId: string): string {
  const query = new URLSearchParams({ funnel: funnelId });
  if (period !== "today") query.set("period", period);
  return `/sistemas/quiz?${query.toString()}`;
}
