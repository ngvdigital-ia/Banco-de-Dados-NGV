import assert from "node:assert/strict";
import test from "node:test";
import { computeDataFreshness, STALE_AFTER_DAYS } from "../src/lib/alerts-freshness.mjs";

const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

test("STALE_AFTER_DAYS é 2 (contrato que os outros testes assumem)", () => {
  assert.equal(STALE_AFTER_DAYS, 2);
});

test("dado de hoje -> fresco (ageDays 0)", () => {
  const result = computeDataFreshness(day(2026, 8, 16), day(2026, 8, 16));
  assert.deepEqual(result, { ageDays: 0, isStale: false });
});

test("dado de ontem -> fresco (ageDays 1) — sync roda de madrugada, ontem é esperado", () => {
  const result = computeDataFreshness(day(2026, 8, 15), day(2026, 8, 16));
  assert.deepEqual(result, { ageDays: 1, isStale: false });
});

test("dado de 2 dias -> velho (limite escolhido: >= 2, não > 2)", () => {
  // Escolha deliberada: "anteontem" (2 dias) já é sinal de sync parada/quebrada — o
  // limite inclui exatamente 2 dias como velho, não só o que vem depois dele.
  const result = computeDataFreshness(day(2026, 8, 14), day(2026, 8, 16));
  assert.deepEqual(result, { ageDays: 2, isStale: true });
});

test("dado de 15 dias -> velho", () => {
  const result = computeDataFreshness(day(2026, 8, 1), day(2026, 8, 16));
  assert.deepEqual(result, { ageDays: 15, isStale: true });
});

test("hora do dia não infla a idade (asOf meia-noite vs referência 23h59 do mesmo dia)", () => {
  const asOf = new Date(Date.UTC(2026, 7, 16, 0, 0, 0));
  const referenceDate = new Date(Date.UTC(2026, 7, 16, 23, 59, 59));
  assert.deepEqual(computeDataFreshness(asOf, referenceDate), { ageDays: 0, isStale: false });
});

// --- Virada de mês e de ano: nunca idade negativa ---

test("virada de ano (asOf 31/12, referência 01/01) -> ageDays 1, nunca negativo", () => {
  const result = computeDataFreshness(day(2025, 12, 31), day(2026, 1, 1));
  assert.deepEqual(result, { ageDays: 1, isStale: false });
});

test("virada de mês (asOf 31/01, referência 01/02) -> ageDays 1, nunca negativo", () => {
  const result = computeDataFreshness(day(2026, 1, 31), day(2026, 2, 1));
  assert.deepEqual(result, { ageDays: 1, isStale: false });
});

test("asOf no futuro (relógio adiantado) -> nunca idade negativa, tratado como fresco (0)", () => {
  const result = computeDataFreshness(day(2026, 8, 17), day(2026, 8, 16));
  assert.deepEqual(result, { ageDays: 0, isStale: false });
});

// --- Fail-closed: entrada inválida NUNCA lança, sempre vira "velho" ---

test("asOf null -> velho (isStale true), sem lançar", () => {
  assert.doesNotThrow(() => computeDataFreshness(null, day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness(null, day(2026, 8, 16)), { ageDays: null, isStale: true });
});

test("asOf undefined -> velho (isStale true), sem lançar", () => {
  assert.doesNotThrow(() => computeDataFreshness(undefined, day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness(undefined, day(2026, 8, 16)), {
    ageDays: null,
    isStale: true,
  });
});

test("asOf Invalid Date -> velho (isStale true), sem lançar", () => {
  const invalid = new Date("not-a-date");
  assert.doesNotThrow(() => computeDataFreshness(invalid, day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness(invalid, day(2026, 8, 16)), {
    ageDays: null,
    isStale: true,
  });
});

test("asOf de tipo errado (string) -> velho (isStale true), sem lançar", () => {
  assert.doesNotThrow(() => computeDataFreshness("2026-08-14", day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness("2026-08-14", day(2026, 8, 16)), {
    ageDays: null,
    isStale: true,
  });
});

test("asOf de tipo errado (number / objeto solto) -> velho (isStale true), sem lançar", () => {
  assert.doesNotThrow(() => computeDataFreshness(1723852800000, day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness(1723852800000, day(2026, 8, 16)), {
    ageDays: null,
    isStale: true,
  });
  assert.doesNotThrow(() => computeDataFreshness({ date: "2026-08-14" }, day(2026, 8, 16)));
  assert.deepEqual(computeDataFreshness({ date: "2026-08-14" }, day(2026, 8, 16)), {
    ageDays: null,
    isStale: true,
  });
});

test("referenceDate inválida (mesmo com asOf válido) -> velho, sem lançar", () => {
  assert.doesNotThrow(() => computeDataFreshness(day(2026, 8, 16), new Date("garbage")));
  assert.deepEqual(computeDataFreshness(day(2026, 8, 16), new Date("garbage")), {
    ageDays: null,
    isStale: true,
  });
});

test("referenceDate omitida usa o default (new Date()) sem lançar", () => {
  const result = computeDataFreshness(new Date());
  assert.doesNotThrow(() => computeDataFreshness(new Date()));
  assert.equal(result.ageDays, 0);
  assert.equal(result.isStale, false);
});

test("é função pura: não muta as datas recebidas", () => {
  const asOf = day(2026, 8, 14);
  const referenceDate = day(2026, 8, 16);
  const asOfSnapshot = asOf.getTime();
  const refSnapshot = referenceDate.getTime();
  computeDataFreshness(asOf, referenceDate);
  assert.equal(asOf.getTime(), asOfSnapshot);
  assert.equal(referenceDate.getTime(), refSnapshot);
});
