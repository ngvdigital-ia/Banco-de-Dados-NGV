// Formatação do módulo Apps. Cópia deliberada e pequena do formato usado pelos módulos
// Spy e Quiz (cada módulo tem o seu, por ownership — ver o comentário em
// src/components/sistemas/spy/format.ts), mais o formato de dinheiro que só este módulo
// precisa: as compras vêm em centavos e com a moeda ao lado.

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatAmount(amountCents: number | null | undefined, currency: string | null | undefined) {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return "—";
  const code = (currency ?? "BRL").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(amountCents / 100);
  } catch {
    // Moeda que o Intl não reconhece não pode apagar o valor da tela.
    return `${(amountCents / 100).toFixed(2)} ${code}`;
  }
}

export function orDash(value: string | null | undefined) {
  return value != null && String(value).trim() !== "" ? String(value) : "—";
}
