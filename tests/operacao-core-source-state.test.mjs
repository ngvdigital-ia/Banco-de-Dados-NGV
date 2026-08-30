import assert from "node:assert/strict";
import test from "node:test";
import { coreSourceStates, coreSourceStatesHaveStaleEvidence } from "../src/lib/operacao/core-source-state.mjs";

const generatedAt = "2026-08-27T09:30:00.000Z";
const source = (name) => ({ schema_version: 1, source: name, status: "ready", generated_at: generatedAt });

function summary({ freshness = true, spy = true } = {}) {
  return {
    kind: "success",
    sources: {
      spy: spy ? source("spy-analytics") : null,
      nexfy: source("nexfy"),
      banco_ngv: source("banco-ngv"),
      quiz_analytics: source("quiz-analytics"),
      apps_ofertas: source("apps-ofertas"),
      plataforma_cursos: source("plataforma-cursos"),
      monitoramento_ngv: source("monitoramento-ngv"),
    },
    freshness: freshness ? {
      by_source: {
        spy: { is_stale: true, age_hours: 31, generated_at: generatedAt },
        nexfy: { is_stale: false, age_hours: 2, generated_at: generatedAt },
        banco_ngv: { is_stale: false, age_hours: 2, generated_at: generatedAt },
        quiz_analytics: { is_stale: false, age_hours: 2, generated_at: generatedAt },
        apps_ofertas: { is_stale: false, age_hours: 2, generated_at: generatedAt },
        plataforma_cursos: { is_stale: false, age_hours: 2, generated_at: generatedAt },
        monitoramento_ngv: { is_stale: false, age_hours: 2, generated_at: generatedAt },
      },
    } : null,
  };
}

test("flag desligada não acrescenta fonte nem muda a leitura Neon", () => {
  assert.deepEqual(coreSourceStates(summary(), { enabled: false }), []);
});

test("Core pronto normaliza cada fonte e stale nunca vira operante", () => {
  const states = coreSourceStates(summary(), { enabled: true });
  assert.equal(states.length, 7);
  assert.equal(states.find((item) => item.id === "core-spy")?.state, "DEGRADED");
  assert.equal(states.find((item) => item.id === "core-banco-ngv")?.state, "OPERANT");
  assert.equal(states.find((item) => item.id === "core-monitoramento-ngv")?.state, "OPERANT");
  assert.equal(coreSourceStatesHaveStaleEvidence(states), true);
  assert.ok(states.every((item) => item.last_read_at === generatedAt));
});

test("fonte ou freshness ausente permanece PENDING explícito, sem inferência", () => {
  const missingSource = coreSourceStates(summary({ spy: false }), { enabled: true });
  assert.equal(missingSource.find((item) => item.id === "core-spy")?.state, "UNVERIFIED");
  assert.equal(missingSource.find((item) => item.id === "core-spy")?.coverage, "PENDING");

  const missingFreshness = coreSourceStates(summary({ freshness: false }), { enabled: true });
  assert.ok(missingFreshness.every((item) => item.state === "UNVERIFIED"));
  assert.equal(coreSourceStatesHaveStaleEvidence(missingFreshness), false);
});

test("Core indisponível aparece uma vez e nunca inventa estado por fonte", () => {
  const states = coreSourceStates({ kind: "unavailable", code: "SUMMARY_TIMEOUT" }, { enabled: true });
  assert.deepEqual(states.map((item) => item.id), ["ngv-core"]);
  assert.equal(states[0].state, "UNAVAILABLE");
});
