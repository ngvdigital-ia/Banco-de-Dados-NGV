import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGE = new URL("../src/app/(dashboard)/sistemas/quiz/page.tsx", import.meta.url);
const VIEW = new URL("../src/components/sistemas/quiz/quiz-analytics-view.tsx", import.meta.url);
const CREATE = new URL("../src/components/sistemas/quiz/funnel-create-dialog.tsx", import.meta.url);
const RECEIPT = new URL("../src/components/sistemas/quiz/provisioned-funnel-panel.tsx", import.meta.url);

test("Funnel Analytics usa a lista canônica e não mantém fallback de exemplo", async () => {
  const [page, view] = await Promise.all([readFile(PAGE, "utf8"), readFile(VIEW, "utf8")]);
  assert.match(page, /listarFunisQuizAction\(\)/);
  assert.doesNotMatch(page, /DEFAULT_QUIZ_FUNNEL|SISTEMAS_QUIZ_MODULE_ENABLED|Módulo em construção/);
  assert.match(view, /Funil em foco/);
  assert.match(view, /project\.name/);
  assert.match(view, /project\.state/);
  assert.match(view, /project\.origin/);
  assert.match(view, /Nenhum funil disponível/);
});

test("criação orienta sem permitir IDs manuais e entrega tracker preenchido", async () => {
  const [create, receipt] = await Promise.all([readFile(CREATE, "utf8"), readFile(RECEIPT, "utf8")]);
  assert.match(create, /criarFunilQuizAction/);
  assert.match(create, /name="name"/);
  assert.match(create, /name="finalUrl"/);
  assert.match(create, /name="format"/);
  assert.match(create, /name="bancoOfferTrackingId"/);
  assert.match(create, /Orientação desta sessão, não é salva/);
  assert.doesNotMatch(create, /name="projectId"|name="funnelId"|name="pageId"/);
  assert.match(receipt, /Project ID/);
  assert.match(receipt, /Funnel ID/);
  assert.match(receipt, /Page ID/);
  assert.match(receipt, /data-nga-public-key/);
  assert.match(receipt, /1\. Copiar/);
  assert.match(receipt, /2\. Colar/);
  assert.match(receipt, /3\. Publicar/);
  assert.match(receipt, /4\. Testar/);
});
