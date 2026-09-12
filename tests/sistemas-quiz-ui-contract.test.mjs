import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const PAGE = new URL("../src/app/(dashboard)/sistemas/quiz/page.tsx", import.meta.url);
const VIEW = new URL("../src/components/sistemas/quiz/quiz-analytics-view.tsx", import.meta.url);
const CREATE = new URL("../src/components/sistemas/quiz/funnel-create-dialog.tsx", import.meta.url);
const INSTALLER = new URL("../src/components/sistemas/quiz/installer-panel.tsx", import.meta.url);
const execFileAsync = promisify(execFile);

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
  assert.match(view, /Use o botão Criar funil no topo/);
  assert.doesNotMatch(view, /<EmptyProjects provisioningEnabled=/);
});

test("criação tem uma única entrada e instalação segue apenas o funil global selecionado", async () => {
  const [installer, view] = await Promise.all([readFile(INSTALLER, "utf8"), readFile(VIEW, "utf8")]);

  assert.match(installer, /export function InstallerPanel\(\{ projectId \}: \{ projectId: string \}\)/);
  assert.match(installer, /encodeURIComponent\(projectId\)/);
  assert.match(view, /<InstallerPanel projectId=\{project\.projectId\} \/>/);
  assert.doesNotMatch(installer, /const \[projects, setProjects\]/);
  assert.doesNotMatch(installer, /const \[selectedKey, setSelectedKey\]/);
  assert.doesNotMatch(installer, /loadProjects/);
  assert.doesNotMatch(installer, /<FunnelCreationForm onCreated=/);
  assert.doesNotMatch(installer, /htmlFor="quiz-existing-funnel"/);
});

test("seletor global traduz estados conhecidos do Funnel Analytics", async () => {
  const view = await readFile(VIEW, "utf8");

  assert.match(view, /case "awaiting_deploy":\s*return "Aguardando publicação"/s);
  assert.match(view, /case "installed":\s*return "Instalado"/s);
  assert.match(view, /case "receiving_events":\s*return "Recebendo eventos"/s);
  assert.match(view, /projectStateLabel\(project\.state\)/);
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
  const creationForm = installer.slice(installer.indexOf("export function FunnelCreationForm"), installer.indexOf("export function FunnelInstallationSnippets"));
  assert.doesNotMatch(creationForm, /name="projectId"|name="funnelId"|name="pageId"|name="finalUrl"|name="bancoOfferTrackingId"/);

  assert.doesNotMatch(create, /criarFunilQuizAction/);
  assert.doesNotMatch(create, /ProvisionedFunnelPanel/);
  assert.doesNotMatch(view, /ProvisionedFunnelPanel|type CreatedFunnel|onCreated=\{setCreated\}/);
});

test("editar o formulário limpa o erro anterior de criação", async () => {
  const installer = await readFile(INSTALLER, "utf8");
  const creationForm = installer.slice(installer.indexOf("export function FunnelCreationForm"), installer.indexOf("export function FunnelInstallationSnippets"));

  assert.match(creationForm, /const clearCreateError = \(\) => setCreateError\(null\);/);
  assert.match(creationForm, /onChange=\{\(event\) => \{\s*clearCreateError\(\);\s*setName\(event\.target\.value\);/s);
  assert.match(creationForm, /const setFlowFormat = \(nextFormat: FunnelFormat\) => \{\s*clearCreateError\(\);/s);
  assert.match(creationForm, /const updateUrl = \(index: number, value: string\) => \{\s*clearCreateError\(\);/s);
  assert.match(creationForm, /const addQuizPage = \(\) => \{\s*clearCreateError\(\);/s);
  assert.match(creationForm, /const removeQuizPage = \(index: number\) => \{\s*clearCreateError\(\);/s);
});

test("confirmação de publicação aparece apenas em awaiting_deploy e tem payload, loading, sucesso e erro explícitos", async () => {
  const installer = await readFile(INSTALLER, "utf8");
  const confirmationPanel = installer.slice(
    installer.indexOf('{selected.state === "awaiting_deploy" ?'),
    installer.indexOf("<FunnelInstallationSnippets"),
  );

  assert.match(installer, /if \(!selected \|\| selected\.state !== "awaiting_deploy" \|\| confirmingDeployment\) return/);
  assert.match(installer, /method: "PATCH"/);
  assert.match(installer, /JSON\.stringify\(\{ projectId: confirmationProjectId, finalUrl \}\)/);
  assert.match(installer, /setConfirmingDeployment\(true\)/);
  assert.match(installer, /Ativando rastreamento…/);
  assert.match(installer, /Ativar rastreamento/);
  assert.match(installer, /toast\.success\("Páginas confirmadas\. O funil agora está instalado\."\)/);
  assert.match(installer, /setDeploymentError\(/);
  assert.match(installer, /role="alert"/);
  assert.match(confirmationPanel, /selected\.state === "awaiting_deploy"/);
  assert.match(confirmationPanel, /Ativar rastreamento/);
  assert.doesNotMatch(confirmationPanel, /receiving_events|selected\.state === "installed"/);
  assert.match(confirmationPanel, /Situação atual: \{stateLabel\(selected\.state\)\}/);
});

test("confirmação não atualiza o funil novo quando a resposta pertence ao funil anterior", async () => {
  const installer = await readFile(INSTALLER, "utf8");
  const confirmationStart = installer.indexOf("const confirmDeployment = async");
  const confirmation = installer.slice(confirmationStart, installer.indexOf("  return (", confirmationStart));

  assert.match(confirmation, /const confirmationProjectId = projectId/);
  assert.match(installer, /const activeProjectIdRef = useRef\(projectId\)/);
  assert.match(installer, /activeProjectIdRef\.current = projectId/);
  assert.match(confirmation, /const confirmationIsCurrent = \(\) => activeProjectIdRef\.current === confirmationProjectId/);
  assert.match(confirmation, /if \(!confirmationIsCurrent\(\)\) return;[\s\S]*setSelected\(confirmed\)/);
  assert.match(confirmation, /catch \(error\) \{\s*if \(!confirmationIsCurrent\(\)\) return;[\s\S]*setDeploymentError/s);
  assert.match(confirmation, /finally \{\s*if \(confirmationIsCurrent\(\)\) setConfirmingDeployment\(false\);\s*\}/s);
  assert.match(installer, /useEffect\(\(\) => \{\s*setConfirmingDeployment\(false\);\s*setDeploymentError\(null\);/s);
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

test("instalação oferece prompt único para Claude ou Codex sem remover a cópia manual", async () => {
  const installer = await readFile(INSTALLER, "utf8");

  assert.match(installer, /<TabsList aria-label="Modo de instalação do tracker">/);
  assert.match(installer, /<TabsTrigger value="manual">Manual<\/TabsTrigger>/);
  assert.match(installer, /<TabsTrigger value="claude-codex">Claude \/ Codex<\/TabsTrigger>/);
  assert.match(installer, /<FunnelInstallationSnippets pages=\{installationPages\} \/>/);
  assert.match(installer, /<ClaudeCodexInstallPrompt funnelName=\{projectName\(selected\)\} pages=\{installationPages\} \/>/);
  assert.match(installer, /export function buildClaudeCodexPrompt/);
  assert.match(installer, /export function canCopyClaudeCodexPrompt/);
  assert.match(installer, /Localize no repositório o arquivo que publica exatamente a URL informada/);
  assert.match(installer, /imediatamente antes de <\/head>/);
  assert.match(installer, /exatamente uma vez naquela página/);
  assert.match(installer, /Preserve todos os scripts, links, metatags e comportamentos já existentes/);
  assert.match(installer, /execute os testes e o build aplicáveis, publique a alteração/);
  assert.match(installer, /Copiar prompt para Claude \/ Codex/);
  assert.match(installer, /aria-live="polite"/);
});

test("prompt do agente bloqueia cópia parcial e não instrui instalar placeholder", async () => {
  const script = `
    import { buildClaudeCodexPrompt, canCopyClaudeCodexPrompt } from ${JSON.stringify(INSTALLER.pathname)};
    const partial = [{ label: "Quiz", url: "https://exemplo.test/quiz", snippet: "<script>ok</script>" }, { label: "VSL", url: "https://exemplo.test/vsl" }];
    const complete = [{ label: "Quiz", url: "https://exemplo.test/quiz", snippet: "<script>ok</script>" }];
    console.log(JSON.stringify({
      partialCanCopy: canCopyClaudeCodexPrompt(partial),
      emptyCanCopy: canCopyClaudeCodexPrompt([]),
      completeCanCopy: canCopyClaudeCodexPrompt(complete),
      partialPrompt: buildClaudeCodexPrompt({ funnelName: "Teste", pages: partial }),
    }));
  `;
  const { stdout } = await execFileAsync("./node_modules/.bin/tsx", ["-e", script], { cwd: process.cwd() });
  const result = JSON.parse(stdout);

  assert.equal(result.partialCanCopy, false);
  assert.equal(result.emptyCanCopy, false);
  assert.equal(result.completeCanCopy, true);
  assert.match(result.partialPrompt, /Não instale nem publique um placeholder/);
  assert.match(result.partialPrompt, /VSL: https:\/\/exemplo\.test\/vsl/);
  assert.doesNotMatch(result.partialPrompt, /Insira o snippet correspondente/);
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
