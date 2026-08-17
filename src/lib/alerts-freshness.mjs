/**
 * Decisão pura de "o dado usado pelo alerta está velho?"
 *
 * O Motor de Alertas (`alerts-eval.ts`) soma os últimos 7 dias sincronizados de um
 * dashboard numa janela DESLIZANTE (não ancorada em hoje) — isso é intencional, suaviza
 * ruído de dia parcial, e continua intocado aqui. `computeMetricValue` já calcula e
 * devolve `asOf` (o dia mais recente que entrou na soma), mas ninguém comparava essa
 * data com hoje: se o dado for de duas semanas atrás, o alerta ainda dispara (ou deixa
 * de disparar) sobre número congelado, mostrando a data antiga como informação neutra.
 *
 * Esta função só faz o sistema ENXERGAR isso — não decide se o alerta dispara, não
 * suprime disparo por dado velho (o número velho ainda pode ser um problema real).
 *
 * Limite: 2 dias. Diferente das 26h usadas noutro ponto do painel (evidência live) —
 * de propósito: aqui o dado é DIÁRIO e a sincronização roda de madrugada, então "ontem"
 * (1 dia de idade) é normal e esperado. "Anteontem" (2 dias) já é sinal de sync parada
 * ou quebrada — por isso o limite inclui exatamente 2 dias como velho (`>=`, não `>`).
 *
 * Fail-closed: `asOf` nulo, Date inválida (`Invalid Date`) ou de outro tipo (string,
 * number, objeto solto) -> sempre tratado como VELHO (`isStale: true`, `ageDays: null`
 * porque a idade real é desconhecida). Uma guarda de frescor nunca pode lançar em
 * produção — cron de alerta não pode cair por causa da própria guarda de segurança.
 *
 * Extraída como função pura (sem I/O, sem `Date.now()` implícito — recebe a data de
 * referência) para ser testável sem chamar a rota nem o banco de verdade.
 */

/** Idade (em dias) a partir da qual o dado é considerado velho. `ageDays >= 2` -> velho. */
export const STALE_AFTER_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * @param {Date | null | undefined} asOf dia mais recente sincronizado (de `MetricResult.asOf`)
 * @param {Date} [referenceDate] data de referência ("hoje"); default `new Date()`
 * @returns {{ ageDays: number | null, isStale: boolean }}
 *   `ageDays: null` só ocorre no caminho fail-closed (entrada inválida) — idade real
 *   desconhecida. `isStale` nunca é `null`: entrada inválida é sempre `true`.
 */
export function computeDataFreshness(asOf, referenceDate = new Date()) {
  if (!isValidDate(asOf) || !isValidDate(referenceDate)) {
    return { ageDays: null, isStale: true };
  }

  // Trunca as duas datas pra meia-noite UTC antes de subtrair: evita que a HORA do dia
  // (ex.: asOf meia-noite vs referenceDate 23h59) infle a idade em fração de dia, e é a
  // mesma base (UTC) que `new Date('YYYY-MM-DD')` usa ao parsear a data que vem do
  // Postgres em alerts-eval.ts — sem isso, fuso local desalinha os dois lados.
  const asOfDayMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const refDayMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  const rawAgeDays = Math.round((refDayMs - asOfDayMs) / MS_PER_DAY);
  // asOf "no futuro" (relógio de origem adiantado, corrida entre cron e leitura) nunca
  // deve virar idade negativa — trata como o mais fresco possível (0), nunca inventa.
  const ageDays = rawAgeDays < 0 ? 0 : rawAgeDays;

  return { ageDays, isStale: ageDays >= STALE_AFTER_DAYS };
}
