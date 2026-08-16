import assert from "node:assert/strict";
import test from "node:test";
import {
  PERIOD_PRESETS,
  isPeriodKey,
  parsePeriodKey,
  resolveCustomRange,
  resolvePeriod,
  toDateInputValue,
} from "../src/components/sistemas/quiz/period.ts";

test("PERIOD_PRESETS inclui as 7 opções do original (dashboard.js), 'Personalizado' por último", () => {
  assert.equal(PERIOD_PRESETS.length, 7);
  assert.deepEqual(
    PERIOD_PRESETS.map((p) => p.key),
    ["today", "yesterday", "7", "15", "30", "max", "custom"],
  );
  assert.equal(PERIOD_PRESETS.at(-1).label, "Personalizado");
});

test("isPeriodKey/parsePeriodKey reconhecem 'custom' como período válido", () => {
  assert.equal(isPeriodKey("custom"), true);
  assert.equal(parsePeriodKey("custom"), "custom");
  assert.equal(parsePeriodKey("nao-existe"), "today", "chave desconhecida cai no default, nunca quebra");
});

test("toDateInputValue formata como <input type=date> (YYYY-MM-DD, local)", () => {
  assert.equal(toDateInputValue(new Date(2026, 7, 3)), "2026-08-03");
  assert.equal(toDateInputValue(new Date(2026, 0, 9)), "2026-01-09");
});

test("resolveCustomRange: De <= Até aplica o intervalo pedido, exclusivo no dia seguinte a Até", () => {
  const range = resolveCustomRange("2026-08-01", "2026-08-05");
  assert.equal(range.from, new Date("2026-08-01T00:00:00").toISOString());
  assert.equal(range.to, new Date("2026-08-06T00:00:00").toISOString(), "to é exclusivo — dia seguinte a Até, mesma regra do rangeFor() original");
  assert.equal(range.label, "01/08/2026 → 05/08/2026");
});

test("resolveCustomRange: De == Até é um intervalo de 1 dia válido (não quebra)", () => {
  const range = resolveCustomRange("2026-08-01", "2026-08-01");
  assert.equal(range.from, new Date("2026-08-01T00:00:00").toISOString());
  assert.equal(range.to, new Date("2026-08-02T00:00:00").toISOString());
  assert.equal(range.label, "01/08/2026 → 01/08/2026");
});

test("resolveCustomRange: De > Até é o caso que QUEBRA no original (dashboard.js:165, toast + return) — aqui inverte em vez de gerar range inválido", () => {
  const invertido = resolveCustomRange("2026-08-10", "2026-08-02");
  const direto = resolveCustomRange("2026-08-02", "2026-08-10");
  assert.deepEqual(invertido, direto, "De > Até produz o MESMO resultado que já vindo na ordem certa — nunca from > to");
  assert.ok(
    new Date(invertido.from).getTime() < new Date(invertido.to).getTime(),
    "o range resultante nunca pode ter from >= to",
  );
  assert.equal(invertido.label, "02/08/2026 → 10/08/2026");
});

test("resolveCustomRange: data ausente ou fora do formato YYYY-MM-DD cai em 'hoje' (mesmo default do preset today), nunca lança", () => {
  const semNada = resolveCustomRange(undefined, undefined);
  const hoje = resolvePeriod("today");
  assert.equal(semNada.from, hoje.from);
  assert.equal(semNada.to, hoje.to);

  const invalida = resolveCustomRange("data-invalida", "2026-13-40");
  assert.equal(invalida.from, hoje.from);
  assert.equal(invalida.to, hoje.to);
});

test("resolvePeriod('custom', from, to) delega pra resolveCustomRange", () => {
  const viaResolvePeriod = resolvePeriod("custom", "2026-08-10", "2026-08-02");
  const direto = resolveCustomRange("2026-08-10", "2026-08-02");
  assert.deepEqual(viaResolvePeriod, direto);
});
