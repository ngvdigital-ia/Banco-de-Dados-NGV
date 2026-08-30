import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [directory, route, sidebar, detail, operation, dashboard] = await Promise.all([
  readFile(new URL("../src/lib/operacao/system-directory.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(dashboard)/sistemas/[system]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/operacao/system-detail-view.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/operacao/operation-view.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(dashboard)/dashboard/page.tsx", import.meta.url), "utf8"),
]);

const ALLOWED_MONITORAMENTO_FIELDS = new Set([
  "generated_at",
  "projects_total",
  "projects_active",
  "projects_attention",
  "domains_total",
  "domains_expiring_30d",
  "domains_pending_decision",
  "subscriptions_active",
  "infra_resources_total",
  "infra_resources_attention",
]);

function monitoramentoFields(fragment) {
  return [...fragment.matchAll(/(?:source|(?:summary\.)?sources\.monitoramento_ngv)\?\.(\w+)/g)].map((match) => match[1]);
}

function monitoramentoFragment(source, expression) {
  const match = source.match(expression);
  assert.ok(match, "Bloco Monitoramento esperado não foi encontrado.");
  return match[1];
}

test("Monitoramento usa o diretório canônico e a rota genérica protegida", () => {
  assert.match(directory, /"monitoramento"/);
  assert.match(directory, /monitoramento:\s*\{/);
  assert.match(route, /import \{ isSystemId, SYSTEM_IDS \}/);
  assert.match(route, /SYSTEM_IDS\.map\(\(system\) => \(\{ system \}\)\)/);
  assert.match(route, /await requireOperationOperator\(\)/);
  assert.match(route, /isOperationCockpitEnabled \|\| !isSystemId\(system\)/);
});

test("sidebar expõe Monitoramento como link interno com alvo de toque", () => {
  assert.match(sidebar, /\{ title: "Monitoramento", href: "\/sistemas\/monitoramento", icon: ServerCog \}/);
  assert.match(sidebar, /className="group\/item h-11 rounded-md px-3 transition-all duration-150 ease-in-out md:h-9"/);
  assert.doesNotMatch(sidebar, /monitoramento[^\n]*target="_blank"/i);
});

test("detail, operação e dashboard usam somente agregados autorizados", () => {
  const detailMonitoramento = monitoramentoFragment(detail, /case "monitoramento": \{([\s\S]*?)\n    \}/);
  const operationMonitoramento = monitoramentoFragment(operation, /\{ key: "monitoramento_ngv",([\s\S]*?)\n  \];/);
  const dashboardMonitoramento = monitoramentoFragment(dashboard, /<CoreSystemMetric label="Monitoramento"([\s\S]*?)\/>/);

  for (const fragment of [detailMonitoramento, operationMonitoramento, dashboardMonitoramento]) {
    const fields = monitoramentoFields(fragment);
    assert.ok(fields.length > 0, "A UI deve ler pelo menos um contador autorizado.");
    assert.ok(fields.every((field) => ALLOWED_MONITORAMENTO_FIELDS.has(field)), `Campo não autorizado: ${fields.join(", ")}`);
    assert.doesNotMatch(fragment, /(?:project|domain|subscription|infra_resource)_(?:id|name|url|cost|price|identifier)/i);
  }
});

test("textos não promovem idade do Core a saúde externa", () => {
  assert.match(detail, /Esta idade descreve a leitura do Core, não a saúde externa\./);
  assert.match(operation, /não confirma a saúde externa de nenhum sistema\./);
  assert.match(dashboard, /não a saúde externa dos sistemas\./);
});
