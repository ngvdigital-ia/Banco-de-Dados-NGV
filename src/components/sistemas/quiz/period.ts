// Cálculo de período server-side pras 4 abas do módulo Quiz — mesmos presets do
// dashboard vanilla antigo (workspaces/ofertas-ngv/quiz-analytics/dashboard.js,
// função rangeFor()), reimplementado aqui puro/testável em vez de portado 1:1
// (o original mexe direto no DOM). kiss: sem período "personalizado" nesta
// entrega — nenhum dos 4 requisitos do briefing pede seletor de data livre;
// os 6 presets cobrem o uso real. Adiciona quando alguém pedir de verdade.

export type PeriodKey = "today" | "yesterday" | "7" | "15" | "30" | "max";

export const DEFAULT_PERIOD: PeriodKey = "today";

export const PERIOD_PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7", label: "7 dias" },
  { key: "15", label: "15 dias" },
  { key: "30", label: "30 dias" },
  { key: "max", label: "Máximo" },
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7": "Últimos 7 dias",
  "15": "Últimos 15 dias",
  "30": "Últimos 30 dias",
  max: "Máximo",
};

export interface PeriodRange {
  from: string | null;
  to: string | null;
  label: string;
}

export function isPeriodKey(value: string | undefined): value is PeriodKey {
  return !!value && Object.prototype.hasOwnProperty.call(PERIOD_LABELS, value);
}

export function parsePeriodKey(value: string | undefined): PeriodKey {
  return isPeriodKey(value) ? value : DEFAULT_PERIOD;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function resolvePeriod(periodParam: string | undefined): PeriodRange {
  const period = parsePeriodKey(periodParam);
  const today = startOfDay(new Date());

  if (period === "max") return { from: null, to: null, label: PERIOD_LABELS.max };
  if (period === "yesterday") {
    return { from: addDays(today, -1).toISOString(), to: today.toISOString(), label: PERIOD_LABELS.yesterday };
  }
  if (period === "7" || period === "15" || period === "30") {
    const days = Number(period);
    return { from: addDays(today, -(days - 1)).toISOString(), to: addDays(today, 1).toISOString(), label: PERIOD_LABELS[period] };
  }
  return { from: today.toISOString(), to: addDays(today, 1).toISOString(), label: PERIOD_LABELS.today };
}
