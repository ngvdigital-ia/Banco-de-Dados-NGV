// Cálculo de período server-side pras 5 abas do módulo Quiz — mesmos presets do
// dashboard vanilla antigo (workspaces/ofertas-ngv/quiz-analytics/dashboard.js,
// funções rangeFor()/selectPeriod()/o listener de #applyCustomBtn), reimplementado
// aqui puro/testável em vez de portado 1:1 (o original mexe direto no DOM).

export type PeriodKey = "today" | "yesterday" | "7" | "15" | "30" | "max" | "custom";

export const DEFAULT_PERIOD: PeriodKey = "today";

export const PERIOD_PRESETS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7", label: "7 dias" },
  { key: "15", label: "15 dias" },
  { key: "30", label: "30 dias" },
  { key: "max", label: "Máximo" },
  { key: "custom", label: "Personalizado" },
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7": "Últimos 7 dias",
  "15": "Últimos 15 dias",
  "30": "Últimos 30 dias",
  max: "Máximo",
  custom: "Personalizado",
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

// Mesmo formato do <input type="date"> (YYYY-MM-DD), local — espelha isoDateInput()
// do dashboard.js original, usado tanto pra pré-preencher os campos De/Até quanto
// nos testes.
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Período "Personalizado" (De/Até). O original (dashboard.js:159-169) barra com um
// toast quando De > Até e não aplica nada — não dá pra fazer o mesmo aqui porque o
// formulário é um GET puro sem JS síncrono pra interceptar o submit (mesma filosofia
// das outras 6 opções: navegação por link/form, sem cliente buscando dado). Em vez de
// deixar passar um intervalo invertido pro adapter (que devolveria daí zero linhas,
// silenciosamente), inverte as duas pontas — o usuário ainda vê o intervalo que pediu,
// só com De/Até na ordem certa. Data ausente/inválida cai em "hoje" (mesmo default do
// preset "today").
export function resolveCustomRange(fromParam: string | undefined, toParam: string | undefined): PeriodRange {
  const today = startOfDay(new Date());
  const parsedFrom = parseDateInput(fromParam) ?? today;
  const parsedTo = parseDateInput(toParam) ?? today;
  const [from, endDay] = parsedFrom > parsedTo ? [parsedTo, parsedFrom] : [parsedFrom, parsedTo];
  return {
    from: from.toISOString(),
    to: addDays(endDay, 1).toISOString(),
    label: `${formatDateBR(from)} → ${formatDateBR(endDay)}`,
  };
}

export function resolvePeriod(periodParam: string | undefined, customFrom?: string, customTo?: string): PeriodRange {
  const period = parsePeriodKey(periodParam);
  const today = startOfDay(new Date());

  if (period === "custom") return resolveCustomRange(customFrom, customTo);
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
