import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGE = new URL("../src/app/(dashboard)/sistemas/quiz/page.tsx", import.meta.url);
const VIEW = new URL("../src/components/sistemas/quiz/quiz-analytics-view.tsx", import.meta.url);
const CREATE = new URL("../src/components/sistemas/quiz/funnel-create-dialog.tsx", import.meta.url);
const INSTALLER = new URL("../src/components/sistemas/quiz/installer-panel.tsx", import.meta.url);

test("Funnel Analytics usa adapter read-only no render e não mantém fallback de exemplo", async () => {
  const [page, view] = await Promise.all([readFile(PAGE, "utf8"), readFile(VIEW, "utf8")]);
  assert.match(page, /listQuizDashboardProjects\(\)/);
  assert.doesNotMatch(page, /listarFunisQuizAction\(|criarFunilQuizAction\(/, "render não pode disparar Server Action auditável ou mutável");
  assert.doesNotMatch(page, /DEFAULT_QUIZ_FUNNEL|SISTEMAS_QUIZ_MODULE_ENABLED|Módulo em construção/);
  assert.match(view, /Funil em foco/);
  assert.match(view, /project\.name/);
  assert.match(view, /project\.state/);
  assert.match(view, /project\.origin/);
  assert.match(view, /Nenhum funil disponível/);
});

test("criação usa o fluxo V2 por páginas, sem IDs técnicos ou ação V1 expostos", async () => {
  const [create, installer, view] = await Promise.all([
    readFile(CREATE, "utf8"),
    readFile(INSTALLER, "utf8"),
    readFile(VIEW, "utf8"),
  ]);

  assert.match(create, /FunnelCreationForm/);
  assert.match(installer, /fetch\("\/api\/sistemas\/quiz\/funis"/);
  assert.match(installer, /method: "POST"/);
  assert.match(installer, /name,\s*format,\s*pages:/s);
  assert.match(installer, /SelectItem value="quiz">Quiz → VSL/);
  assert.match(installer, /SelectItem value="presell">Presell → VSL/);
  assert.match(installer, /Adicionar etapa do quiz/);
  assert.doesNotMatch(installer, /name="projectId"|name="funnelId"|name="pageId"|name="finalUrl"|name="bancoOfferTrackingId"/);

  assert.doesNotMatch(create, /criarFunilQuizAction/);
  assert.doesNotMatch(create, /ProvisionedFunnelPanel/);
  assert.doesNotMatch(view, /ProvisionedFunnelPanel|type CreatedFunnel|onCreated=\{setCreated\}/);
});

test("sucesso mostra um trecho por página e abre o funil criado na instalação", async () => {
  const [create, installer] = await Promise.all([readFile(CREATE, "utf8"), readFile(INSTALLER, "utf8")]);

  assert.match(create, /FunnelInstallationSnippets/);
  assert.match(create, /pages=\{created\.installationPages\}/);
  assert.match(installer, /pages\.map\(\(page, index\)/);
  assert.match(installer, /Trecho desta página/);
  assert.match(installer, /Copiar trecho desta página/);
  assert.match(create, /query\.set\("project", projectId\)/);
  assert.match(create, /query\.set\("tab", "installer"\)/);
  assert.match(create, /query\.delete\("funnel"\)/);
  assert.match(create, /router\.push\(`\$\{pathname\}\?\$\{query\.toString\(\)\}`\)/);
});

test("leitura selecionada mantém project e funnel canônicos; período preserva o project", async () => {
  const [page, view] = await Promise.all([readFile(PAGE, "utf8"), readFile(VIEW, "utf8")]);

  assert.match(page, /projectId: selectedProject\.projectId/);
  assert.match(page, /funnelId: selectedProject\.funnelId/);
  assert.match(view, /<PeriodFilter current=\{period\}[^>]*projectId=\{project\.projectId\}/);
  assert.match(view, /query\.set\("project", projectId\)/);
  assert.doesNotMatch(view, /query\.set\("funnel", projectId\)/);
});

test("a aba de respostas depende da metadata do analytics, não da lista de respostas", async () => {
  const [view, helper] = await Promise.all([
    readFile(VIEW, "utf8"),
    readFile(new URL("../src/components/sistemas/quiz/answers-tab.ts", import.meta.url), "utf8"),
  ]);
  assert.match(view, /shouldShowAnswersTab\(data\.metadata\)/);
  assert.doesNotMatch(view, /shouldShowAnswersTab\(data\.metadata, created\?\.format\)/);
  assert.doesNotMatch(view, /responses\.length/);
  assert.match(helper, /metadata\.hasQuizAnswers === true/);
});
