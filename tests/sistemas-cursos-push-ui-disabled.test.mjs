import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formSource = await readFile(
  new URL("../src/components/sistemas/cursos/push-campaign-form.tsx", import.meta.url),
  "utf8",
);
const pageSource = await readFile(
  new URL("../src/app/(dashboard)/sistemas/cursos/page.tsx", import.meta.url),
  "utf8",
);

test("a tela de composição NUNCA importa a função de disparo real nem o wrapper com auditoria", () => {
  assert.doesNotMatch(formSource, /sendCursosPushCampaign/, "componente não pode importar o adapter que chama o OneSignal");
  assert.doesNotMatch(formSource, /dispatchCursosPushCampaignWithAudit/, "componente não pode importar o wrapper de disparo");
  assert.doesNotMatch(formSource, /push-client\.mjs/, "componente não pode importar o módulo runtime do adapter (só tipos, via types.ts)");
  assert.doesNotMatch(formSource, /push-dispatch/, "componente não pode importar o wiring de disparo em nenhuma forma");
});

test("o botão de envio é desabilitado de forma LITERAL (nunca uma expressão que poderia ficar true)", () => {
  const buttonBlock = formSource.slice(
    formSource.indexOf("Enviar campanha") - 400,
    formSource.indexOf("Enviar campanha") + 50,
  );
  assert.match(buttonBlock, /disabled(?!=)/, "prop `disabled` precisa estar presente e sem valor dinâmico (JSX shorthand = true)");
  assert.doesNotMatch(buttonBlock, /disabled=\{/, "disabled não pode depender de uma expressão/estado — tem que ser sempre true");
  assert.doesNotMatch(buttonBlock, /onClick=/, "botão desabilitado não deve ter handler de clique nenhum");
});

test("a tela mostra aviso visível de que o disparo está desligado", () => {
  assert.match(formSource, /Disparo desabilitado/);
  assert.match(formSource, /nunca (dispara|chama o OneSignal)/);
});

test("a rota chama requireModuleAccess('cursos', 'read') como primeira linha executável da página", () => {
  const fnBody = pageSource.slice(pageSource.indexOf("export default async function CursosModulePage"));
  const firstStatement = fnBody.split("{").slice(1).join("{").trim().split("\n")[0].trim();
  assert.match(firstStatement, /await requireModuleAccess\("cursos", "read"\);/);
});

test("a rota é controlada por SISTEMAS_CURSOS_MODULE_ENABLED e nunca liga por omissão", () => {
  assert.match(pageSource, /SISTEMAS_CURSOS_MODULE_ENABLED/);
  assert.match(pageSource, /process\.env\.SISTEMAS_CURSOS_MODULE_ENABLED === "true"/);
});

test("a rota nunca importa nem chama o disparo real", () => {
  assert.doesNotMatch(pageSource, /sendCursosPushCampaign/);
  assert.doesNotMatch(pageSource, /dispatchCursosPushCampaignWithAudit/);
});
