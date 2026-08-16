// Formatação numérica/temporal compartilhada pelos painéis do módulo Spy. Cópia deliberada e
// pequena (não reusa src/components/sistemas/quiz/format.ts) — os dois módulos são independentes
// por ownership (squad banco-ngv, AGENTS.md) e não devem acoplar por conveniência.

export function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(Number(value ?? 0));
}

// tolerância é sempre negativa por convenção do Spy (S.tolerancia é subtraído do score —
// index.html do Spy renderiza "−{tolerancia}%"). Espelha essa convenção pra não surpreender quem
// já usa o painel externo.
export function formatTolerance(value: number | null | undefined) {
  return `−${Number(value ?? 0)}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
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

export function formatPeriodo(value: "manha" | "noite" | string) {
  return value === "noite" ? "Noite" : "Manhã";
}
