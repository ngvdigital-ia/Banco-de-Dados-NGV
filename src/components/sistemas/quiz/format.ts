// Formatação numérica/temporal compartilhada pelas 4 abas do módulo Quiz.
// Espelha o formato do dashboard vanilla antigo (workspaces/ofertas-ngv/quiz-analytics/dashboard.js)
// pra não surpreender quem já usa o painel externo, mas em pt-BR/Intl (sem manipulação de string).

export function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: n > 0 && n < 10 ? 1 : 0 })}%`;
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Sem leitura";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem leitura";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatEventValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}
