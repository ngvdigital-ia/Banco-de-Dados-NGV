import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [detail, directory, sidebar, dashboard, operation] = await Promise.all([
  readFile(new URL("../src/components/operacao/system-detail-view.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/operacao/system-directory.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(dashboard)/dashboard/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/operacao/operation-view.tsx", import.meta.url), "utf8"),
]);

test("Banco NGV usa Dados do dashboard como título interno, sem duplicar a lista de ofertas", () => {
  assert.match(directory, /title: "Banco NGV"/);
  assert.match(detail, /label: "Ofertas cadastradas"/);
  assert.match(detail, /const detailTitle = system === "banco-ngv" \? "Dados do dashboard"/);
  assert.match(detail, /Registros de oferta que já existem no dashboard/);
  assert.match(detail, /action: \{ href: "\/offers\?month=all", label: "Ver todas as ofertas" \}/);
  assert.match(detail, /label: "Registros históricos de métricas"/);
  assert.match(detail, /Leituras datadas de métricas; não representam novas ofertas/);
  assert.match(detail, /Última leitura de métrica:/);
  assert.match(detail, /details\.metrics\.length % 2 === 1/);
  assert.match(detail, /"sm:col-span-2"/);
  assert.doesNotMatch(detail, /Ofertas rastreadas/);
  assert.doesNotMatch(detail, /Snapshots de métricas/);
});

test("Monitoramento explica os agregados sem inventar ativos individuais", () => {
  for (const label of [
    "Projetos cadastrados",
    "Domínios monitorados",
    "Vencem em 30 dias",
    "Serviços com cobrança ativa",
    "Recursos que pedem revisão",
  ]) {
    assert.match(detail, new RegExp(`label: "${label}"`));
  }
  assert.match(detail, /Projetos e domínios não têm relação 1:1/);
  assert.match(detail, /Este resumo não traz nomes ou URLs/);
  assert.match(detail, /sourceLabel: "monitoramento-ngv no resumo do Core"/);
});

test("Funnel Analytics substitui o nome anterior na navegação e nas projeções", () => {
  assert.match(sidebar, /title: "Funnel Analytics", href: "\/sistemas\/quiz", icon: BarChart3/);
  assert.match(dashboard, /<CoreSystemMetric label="Funnel Analytics"/);
  assert.match(dashboard, /funis com eventos recebidos/);
  assert.match(operation, /Funnel Analytics/);
  assert.doesNotMatch(sidebar, /title: "Quiz Analytics"/);
});
