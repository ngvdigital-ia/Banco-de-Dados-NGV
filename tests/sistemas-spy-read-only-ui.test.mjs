import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Spy entrega leitura completa com mutações desligadas por padrão", async () => {
  const [page, view] = await Promise.all([
    source("src/app/(dashboard)/sistemas/spy/page.tsx"),
    source("src/components/sistemas/spy/spy-estado-view.tsx"),
  ]);

  assert.match(page, /const isSpyMutationsEnabled = \(\) => process\.env\.SISTEMAS_SPY_MUTATIONS_ENABLED === "true";/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_SISTEMAS_SPY_MUTATIONS_ENABLED/);
  assert.match(page, /<SpyEstadoView result=\{result\} mutationsEnabled=\{isSpyMutationsEnabled\(\)\} \/>/);

  assert.match(view, /Somente leitura/);
  assert.match(view, /<SummaryCards data=\{data\} \/>/);
  assert.match(view, /<PainelPanel data=\{data\} \/>/);
  assert.match(view, /<GraficoPanel data=\{data\} \/>/);
  assert.match(view, /<ProntasPanel data=\{data\} \/>/);
  assert.match(view, /<LeiturasPanel data=\{data\} \/>/);
  assert.match(view, /<CriteriosSomenteLeitura data=\{data\} \/>/);
});

test("as sete superfícies mutáveis do Spy ficam ausentes no modo somente leitura", async () => {
  const [view, leitura, ofertas, criterios] = await Promise.all([
    source("src/components/sistemas/spy/spy-estado-view.tsx"),
    source("src/components/sistemas/spy/leitura-do-dia-panel.tsx"),
    source("src/components/sistemas/spy/ofertas-panel.tsx"),
    source("src/components/sistemas/spy/dados-criterios-panel.tsx"),
  ]);

  for (const [tab, component] of [
    ["leitura", "LeituraDoDiaPanel"],
    ["ofertas", "OfertasPanel"],
    ["dados", "DadosCriteriosPanel"],
  ]) {
    assert.match(
      view,
      new RegExp(`\\{mutationsEnabled \\? \\(\\s*<TabsContent value="${tab}"[\\s\\S]*?<${component} data=\\{data\\} mutationsEnabled=\\{mutationsEnabled\\} \\/>[\\s\\S]*?\\) : null\\}`),
      `${component} não pode ser montado quando mutationsEnabled for false`,
    );
  }

  for (const [name, component] of [
    ["LeituraDoDiaPanel", leitura],
    ["OfertasPanel", ofertas],
    ["DadosCriteriosPanel", criterios],
  ]) {
    assert.match(
      component,
      new RegExp(`export function ${name}\\([\\s\\S]*?if \\(!mutationsEnabled\\) return null;`),
      `${name} precisa falhar fechado mesmo se for chamado fora da rota`,
    );
  }

  const allMutationUi = `${leitura}\n${ofertas}\n${criterios}`;
  for (const action of [
    "criarSpyOfertaAction",
    "editarSpyOfertaAction",
    "removerSpyOfertaAction",
    "salvarSpyLeiturasLoteAction",
    "editarSpyLeituraAction",
    "removerSpyLeituraAction",
    "atualizarSpyConfigAction",
  ]) {
    assert.match(allMutationUi, new RegExp(`\\b${action}\\b`), `superfície ${action} precisa permanecer protegida`);
  }
});

test("opt-in verdadeiro preserva as três áreas mutáveis e seus controles", async () => {
  const view = await source("src/components/sistemas/spy/spy-estado-view.tsx");

  for (const label of ["Leitura do dia", "Ofertas", "Dados e critérios"]) {
    assert.match(view, new RegExp(`mutationsEnabled \\? <TabsTrigger[^>]*>${label}<\\/TabsTrigger> : null`));
  }
});
