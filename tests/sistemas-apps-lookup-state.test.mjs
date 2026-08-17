import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  APPS_LOOKUP_ESTADOS,
  descreverEspelhoApps,
  descreverEstadoProduto,
  descreverLookup,
} from "../src/components/sistemas/apps/lookup-state.mjs";

const PANEL_PATH = new URL("../src/components/sistemas/apps/apps-lookup-panel.tsx", import.meta.url);
const PAGE_PATH = new URL("../src/app/(dashboard)/sistemas/apps-ofertas/page.tsx", import.meta.url);
const ACTIONS_PATH = new URL("../src/app/(dashboard)/sistemas/apps-ofertas/actions.ts", import.meta.url);
const CATCH_ALL_PATH = new URL("../src/app/(dashboard)/sistemas/[system]/page.tsx", import.meta.url);

const corpoCheio = {
  success: true,
  access: [{ offer_slug: "metodo-alpha", status: "active" }],
  purchases: [{ order_id: "ord_1" }],
  products: [{ offer_slug: "metodo-alpha", product_key: "modulo-1", title: "Módulo 1", state: "comprado" }],
};
const corpoVazio = { success: true, access: [], purchases: [], products: [] };

// ── 1. Os 6 estados da tela, cada um com texto próprio ───────────────────────

test("os 6 estados exigidos existem e nenhum cai em texto vazio", () => {
  const casos = [
    { nome: "não pesquisou", entrada: { fase: "idle" }, estado: APPS_LOOKUP_ESTADOS.IDLE },
    { nome: "carregando", entrada: { fase: "loading" }, estado: APPS_LOOKUP_ESTADOS.LOADING },
    { nome: "achou", entrada: { fase: "done", status: 200, body: corpoCheio }, estado: APPS_LOOKUP_ESTADOS.FOUND },
    { nome: "não achou", entrada: { fase: "done", status: 200, body: corpoVazio }, estado: APPS_LOOKUP_ESTADOS.EMPTY },
    { nome: "e-mail inválido", entrada: { fase: "done", status: 400, body: { error: "E-mail inválido" } }, estado: APPS_LOOKUP_ESTADOS.INVALID },
    { nome: "erro", entrada: { fase: "done", status: 500, body: {} }, estado: APPS_LOOKUP_ESTADOS.ERROR },
  ];

  for (const { nome, entrada, estado } of casos) {
    const d = descreverLookup(entrada);
    assert.equal(d.estado, estado, `estado errado para "${nome}"`);
    assert.ok(d.titulo.length > 5, `título vazio/curto demais para "${nome}"`);
    assert.ok(d.detalhe.length > 40, `detalhe raso para "${nome}" — não pode ser erro nu`);
    assert.ok(["neutro", "info", "aviso", "erro"].includes(d.tom));
  }

  // Nenhum dos 6 repete o texto de outro: cada estado ensina uma coisa diferente.
  const titulos = casos.map((c) => descreverLookup(c.entrada).titulo);
  assert.equal(new Set(titulos).size, titulos.length, "dois estados com o mesmo título");
});

test("NÃO-ACHOU é diferente de ERRO — e diz explicitamente que não é erro", () => {
  const naoAchou = descreverLookup({ fase: "done", status: 200, body: corpoVazio });
  const erro = descreverLookup({ fase: "done", status: 500, body: {} });

  assert.notEqual(naoAchou.estado, erro.estado);
  assert.notEqual(naoAchou.titulo, erro.titulo);
  assert.match(naoAchou.detalhe, /NÃO é erro/);
  // e manda o operador conferir o espelho antes de concluir ausência de acesso
  assert.match(naoAchou.detalhe, /espelho/i);
});

test("achou: qualquer uma das 3 listas populada já conta como encontrado", () => {
  for (const chave of ["access", "purchases", "products"]) {
    const body = { ...corpoVazio, [chave]: [{ qualquer: "coisa" }] };
    assert.equal(descreverLookup({ fase: "done", status: 200, body }).estado, APPS_LOOKUP_ESTADOS.FOUND, chave);
  }
});

test("e-mail inválido mostra a mensagem que a ROTA devolveu, não uma inventada", () => {
  const d = descreverLookup({ fase: "done", status: 400, body: { error: "E-mail inválido" } });
  assert.match(d.detalhe, /E-mail inválido/);

  // corpo sem `error` não pode virar "undefined" na tela
  const semMensagem = descreverLookup({ fase: "done", status: 400, body: {} });
  assert.doesNotMatch(semMensagem.detalhe, /undefined/);
  assert.match(semMensagem.detalhe, /E-mail inválido/);
});

test("401/403 e 5xx ensinam o que fazer, e nenhum vira erro nu", () => {
  for (const status of [401, 403]) {
    const d = descreverLookup({ fase: "done", status, body: {} });
    assert.equal(d.estado, APPS_LOOKUP_ESTADOS.UNAUTHORIZED);
    assert.match(d.detalhe, /Saia e entre de novo/);
  }
  for (const status of [500, 502, 504]) {
    const d = descreverLookup({ fase: "done", status, body: {} });
    assert.equal(d.estado, APPS_LOOKUP_ESTADOS.ERROR);
    // o gate de não-mentir: erro do Core não autoriza concluir "sem acesso"
    assert.match(d.detalhe, /NÃO conclua que a pessoa está sem acesso/);
  }
});

test("503 diz que o módulo está desligado por configuração, sem culpar o cliente", () => {
  const d = descreverLookup({ fase: "done", status: 503, body: { code: "APPS_LOOKUP_WRITER_KEY_MISSING" } });
  assert.equal(d.estado, APPS_LOOKUP_ESTADOS.DISABLED);
  assert.match(d.detalhe, /configurado/);
  assert.match(d.detalhe, /Nenhum dado foi consultado/);
});

test("falha de rede (resposta que nem chegou) não vira tela muda nem 'não encontrado'", () => {
  const d = descreverLookup({ fase: "done", falhou: true });
  assert.equal(d.estado, APPS_LOOKUP_ESTADOS.ERROR);
  assert.notEqual(d.estado, APPS_LOOKUP_ESTADOS.EMPTY);
  assert.ok(d.detalhe.length > 40);
});

// ── 2. O aviso do espelho é MEDIDO, não decorativo ──────────────────────────

function resumo({ projetados, naFonte, idade = 5, kind = "success" }) {
  return {
    kind,
    rolling_migration: { apps_ofertas_active_accesses: projetados },
    sources: { apps_ofertas: { access_active: naFonte } },
    freshness: { by_source: { apps_ofertas: { age_hours: idade, is_stale: false } } },
  };
}

test("espelho incompleto (110 de 139) aparece com os números REAIS e a idade", () => {
  const aviso = descreverEspelhoApps(resumo({ projetados: 110, naFonte: 139, idade: 7 }));

  assert.equal(aviso.medido, true);
  assert.equal(aviso.completo, false);
  assert.equal(aviso.projetados, 110);
  assert.equal(aviso.naFonte, 139);
  assert.equal(aviso.faltando, 29);
  assert.equal(aviso.idadeHoras, 7);
  assert.match(aviso.titulo, /110 de 139/);
  assert.match(aviso.titulo, /há 7 h/);
  assert.match(aviso.detalhe, /Faltam 29 acesso/);
  assert.match(aviso.detalhe, /06:15/);
  // o gate que importa: "não encontrei" pode ser espelho incompleto
  assert.match(aviso.detalhe, /PODE ser espelho incompleto/);
  assert.equal(aviso.tom, "aviso");
});

test("espelho completo muda o tom, mas continua dizendo que a fonte da verdade é o Apps", () => {
  const aviso = descreverEspelhoApps(resumo({ projetados: 139, naFonte: 139 }));
  assert.equal(aviso.completo, true);
  assert.equal(aviso.faltando, 0);
  assert.match(aviso.titulo, /Espelho completo/);
  assert.match(aviso.detalhe, /fonte da verdade é o painel do Apps/);
  assert.equal(aviso.tom, "info");
});

// Repro medido no Core em 17/08/2026: o espelho ngv_apps é um número VIVO (110) e a projeção
// apps_offers_daily está CONGELADA desde 16/08 (106) — a RPC do Core recusa snapshot quando as
// contagens mudam. Espelho maior que a fonte não existe no mundo real; antes desta guarda, o
// Math.max() zerava a diferença e a tela dizia "Espelho completo: 110 de 106 acessos" com tom
// "info", enquanto a realidade era 110 de 138 (28 faltando). É o caso que esta tarefa existe
// para impedir.
test("110 espelhados contra 106 na fonte NÃO vira 'completo' — sai como aviso de incoerência", () => {
  const aviso = descreverEspelhoApps(resumo({ projetados: 110, naFonte: 106, idade: 39 }));

  assert.equal(aviso.completo, false, "números que se contradizem NUNCA podem declarar completo");
  assert.equal(aviso.tom, "aviso");
  assert.equal(aviso.coerente, false);
  assert.equal(aviso.medido, true);
  assert.doesNotMatch(aviso.titulo, /completo/i);
  // o detalhe pode (e deve) NEGAR completude — o que ele não pode é AFIRMAR: a frase do
  // ramo realmente-completo não aparece aqui.
  assert.doesNotMatch(aviso.detalhe, /está com todos os acessos/);

  // o título cita OS DOIS números e a idade
  assert.match(aviso.titulo, /não batem/i);
  assert.match(aviso.titulo, /110/);
  assert.match(aviso.titulo, /106/);
  assert.match(aviso.titulo, /há 39 h/);

  // `faltando` não pode virar 0: zero lido como "não falta nada" é a própria mentira
  assert.equal(aviso.faltando, null);

  // e o detalhe ensina o que fazer
  assert.match(aviso.detalhe, /uma das duas medidas está atrasada/);
  assert.match(aviso.detalhe, /NÃO dá pra afirmar/);
  assert.match(aviso.detalhe, /PODE ser espelho incompleto/);
  assert.match(aviso.detalhe, /painel do Apps/);
});

test("qualquer inversão espelho>fonte cai na incoerência, não em 'completo'", () => {
  for (const [projetados, naFonte] of [[141, 139], [1, 0], [200, 106], [111, 110]]) {
    const aviso = descreverEspelhoApps(resumo({ projetados, naFonte }));
    assert.equal(aviso.completo, false, `${projetados}/${naFonte} não pode ser completo`);
    assert.equal(aviso.coerente, false, `${projetados}/${naFonte} não pode ser coerente`);
    assert.equal(aviso.tom, "aviso");
    assert.equal(aviso.faltando, null);
  }
});

test("`completo` só é true quando medido E coerente — invariante da tela", () => {
  const casos = [
    resumo({ projetados: 110, naFonte: 106 }),  // incoerente
    resumo({ projetados: 110, naFonte: 139 }),  // incompleto
    resumo({ projetados: 139, naFonte: 139 }),  // completo
    { kind: "unavailable" },                     // sem medida
    undefined,
  ];
  for (const entrada of casos) {
    const aviso = descreverEspelhoApps(entrada);
    if (aviso.completo) {
      assert.equal(aviso.medido, true);
      assert.equal(aviso.coerente, true);
      assert.equal(aviso.tom, "info");
    }
    // e nenhum estado fica sem o campo
    assert.equal(typeof aviso.coerente, "boolean");
  }
});

test("sem medida (Core indisponível ou campos ausentes) cai no aviso FIXO, nunca em silêncio", () => {
  const semMedida = [
    undefined,
    null,
    {},
    { kind: "unavailable", rolling_migration: null, sources: { apps_ofertas: null }, freshness: null },
    { kind: "disabled", rolling_migration: null, sources: {}, freshness: null },
    resumo({ projetados: 110, naFonte: null }),
    { kind: "success", rolling_migration: null, sources: { apps_ofertas: { access_active: 139 } }, freshness: null },
  ];
  for (const entrada of semMedida) {
    const aviso = descreverEspelhoApps(entrada);
    assert.equal(aviso.medido, false, `deveria ser não-medido: ${JSON.stringify(entrada)}`);
    assert.equal(aviso.tom, "aviso");
    assert.match(aviso.titulo, /pode estar atrasado/);
    assert.match(aviso.detalhe, /fonte da verdade é o painel do Apps/);
    assert.match(aviso.detalhe, /06:15/);
    assert.doesNotMatch(aviso.detalhe, /undefined|null|NaN/);
  }
});

// ── 3. Destaque visual por estado do produto ────────────────────────────────

test("os 3 estados de produto têm rótulo e destaque DIFERENTES entre si", () => {
  const comprado = descreverEstadoProduto("comprado");
  const manual = descreverEstadoProduto("liberado_manual");
  const bloqueado = descreverEstadoProduto("bloqueado");

  assert.deepEqual(comprado, { rotulo: "Comprado", variante: "success" });
  assert.deepEqual(manual, { rotulo: "Liberado manual", variante: "info" });
  assert.deepEqual(bloqueado, { rotulo: "Bloqueado", variante: "neutral" });
  assert.equal(new Set([comprado.variante, manual.variante, bloqueado.variante]).size, 3);
});

test("estado desconhecido não some da tela — vira aviso visível", () => {
  const d = descreverEstadoProduto("estado_novo_do_futuro");
  assert.equal(d.rotulo, "estado_novo_do_futuro");
  assert.equal(d.variante, "warning");
});

// ── 4. A tela renderiza os estados e não vaza PII ───────────────────────────

test("o painel desenha TODO estado pela descrição (nenhum branch de texto solto no JSX)", async () => {
  const src = await readFile(PANEL_PATH, "utf8");
  assert.match(src, /const descricao = descreverLookup\(\{/);
  assert.match(src, /fase,\s*\n\s*status: resultado\?\.status,\s*\n\s*body: resultado\?\.body,\s*\n\s*falhou,/);
  assert.match(src, /titulo=\{descricao\.titulo\}/);
  assert.match(src, /detalhe=\{descricao\.detalhe\}/);
  assert.match(src, /tom=\{descricao\.tom\}/);
  // as 3 fases que o componente controla
  assert.match(src, /setFase\("loading"\)/);
  assert.match(src, /setFase\("done"\)/);
  assert.match(src, /useState<"idle" \| "loading" \| "done">\("idle"\)/);
  // o catch existe: Server Action que estoura vira estado de erro, não tela muda
  assert.match(src, /catch \{[\s\S]*setFalhou\(true\)/);
});

test("o aviso do espelho tira cor E ícone do mesmo `tom` — incoerente nunca aparece como ok", async () => {
  const src = await readFile(PANEL_PATH, "utf8");
  assert.match(src, /tom=\{espelho\.tom\}/);
  assert.match(src, /icone=\{espelho\.tom === "aviso" \? AlertTriangle : Info\}/);
  // o ícone NÃO pode voltar a ser decidido por `completo`: com duas fontes, um estado
  // "aviso" e não-incompleto ganharia ícone amigável em cima de fundo de aviso.
  assert.doesNotMatch(src, /icone=\{espelho\.completo/);
  assert.match(src, /aviso: "border-warning\/40 bg-warning-muted"/);
});

test("o painel mostra os 3 blocos na ordem Acessos → Compras → Produtos", async () => {
  const src = await readFile(PANEL_PATH, "utf8");
  const acessos = src.indexOf('titulo="Acessos"');
  const compras = src.indexOf('titulo="Compras"');
  const produtos = src.indexOf('titulo="Produtos"');
  assert.ok(acessos > 0 && compras > acessos && produtos > compras, "ordem dos blocos");
  assert.match(src, /descreverEstadoProduto\(row\.state\)/);
  assert.match(src, /<StatusBadge variant=\{estado\.variante\}>\{estado\.rotulo\}<\/StatusBadge>/);
});

test("a tela fala com o Server Action — nunca com a edge function nem com a credencial do Core", async () => {
  const src = await readFile(PANEL_PATH, "utf8");
  assert.match(src, /import \{ consultarAcessoAppsAction \} from "@\/app\/\(dashboard\)\/sistemas\/apps-ofertas\/actions"/);
  assert.match(src, /await consultarAcessoAppsAction\(email\)/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /apps-lookup-read/);
  assert.doesNotMatch(src, /x-ngv-core-key/);
  assert.doesNotMatch(src, /WRITER_KEY|CRON_SECRET/);
  assert.doesNotMatch(src, /process\.env/);
});

test("o e-mail aparece SÓ no campo que o operador digitou — nenhum resultado o ecoa", async () => {
  const src = await readFile(PANEL_PATH, "utf8");
  // única ligação do estado `email` ao DOM é o value do input
  assert.equal(src.match(/\{email\}/g)?.length ?? 0, 1);
  assert.match(src, /value=\{email\}/);
  // e nada de token/uuid de pessoa na tabela
  for (const proibido of ["access_token", "core_user_id", "subject_id", "legacy_user_id", "user_id"]) {
    assert.ok(!src.includes(proibido), `o painel não pode renderizar ${proibido}`);
  }
});

// ── 5. A página SOMBREIA o catch-all sem tirar nada de quem já usava a rota ──

test("a página nova reusa SystemDetailView e preserva o gate e o fetch do catch-all", async () => {
  const pagina = await readFile(PAGE_PATH, "utf8");
  const catchAll = await readFile(CATCH_ALL_PATH, "utf8");

  // tudo o que o catch-all renderizava continua sendo renderizado, pelo MESMO componente
  assert.match(catchAll, /<SystemDetailView system=\{system\} summary=\{summary\} \/>/);
  assert.match(pagina, /<SystemDetailView system="apps-ofertas" summary=\{summary\} \/>/);
  assert.match(pagina, /import \{ SystemDetailView \} from "@\/components\/operacao\/system-detail-view"/);

  // mesmo gate de flag (rota que era 404 com o cockpit desligado continua 404)
  assert.match(catchAll, /if \(!isOperationCockpitEnabled \|\| !isSystemId\(system\)\) notFound\(\)/);
  assert.match(pagina, /if \(!isOperationCockpitEnabled\) notFound\(\)/);

  // mesma leitura do Core, com o mesmo aviso no log quando indisponível
  assert.match(pagina, /const summary = await fetchNgvCoreOperationalSummary\(\)/);
  assert.match(pagina, /console\.warn\("\[NGV Core\] operational summary unavailable", \{ code \}\)/);
  assert.match(pagina, /export const dynamic = "force-dynamic"/);

  // e ACRESCENTA o lookup embaixo
  const detail = pagina.indexOf("<SystemDetailView");
  const painel = pagina.indexOf("<AppsLookupPanel");
  assert.ok(detail > 0 && painel > detail, "o lookup entra ABAIXO do que já existia");
});

test("a página passa o aviso de espelho MEDIDO pro painel", async () => {
  const pagina = await readFile(PAGE_PATH, "utf8");
  assert.match(pagina, /const espelho = descreverEspelhoApps\(summary\)/);
  assert.match(pagina, /<AppsLookupPanel espelho=\{espelho\} \/>/);
});

test("authz da página é o gate de módulo com o id que existe no SYSTEM_DIRECTORY", async () => {
  const pagina = await readFile(PAGE_PATH, "utf8");
  assert.match(pagina, /await requireModuleAccess\("apps-ofertas", "read"\)/);
});

// ── 6. Server Action: authz, reuso da regra da rota, segredo no servidor ────

test("o Server Action autoriza, reusa a regra da rota e não recria a lógica", async () => {
  const src = await readFile(ACTIONS_PATH, "utf8");
  assert.match(src, /^"use server";/m);
  assert.match(src, /await requireModuleAccess\("apps-ofertas", "read"\)/);
  assert.match(src, /import \{ handleAppsLookupRequest \} from "@\/lib\/sistemas\/apps\/lookup-core\.mjs"/);
  assert.match(src, /return handleAppsLookupRequest\(\{/);
  // o segredo e a credencial de ingress só existem no servidor
  assert.match(src, /secret: process\.env\.CRON_SECRET/);
  assert.match(src, /writerKey: process\.env\.NGV_CORE_BANCO_WRITER_KEY/);
  // não reimplementa projeção nem validação de e-mail
  assert.doesNotMatch(src, /lookupAppsCustomer|criarFindersDoCore|projectAccessRow/);
});
