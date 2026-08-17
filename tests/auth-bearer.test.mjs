import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isAuthorizedBearer } from "../src/lib/auth-bearer.mjs";
import { isAuthorizedBearer as isAuthorizedBearerFromLookup } from "../src/lib/offers/lookup.mjs";

// O que este arquivo protege
// ─────────────────────────────────────────────────────────────────────────────
// O padrão antigo, repetido em 9 rotas de produção:
//
//     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401
//
// falha ABERTO. Sem CRON_SECRET no ambiente, a interpolação vira a string literal
// "Bearer undefined" — e quem mandar exatamente esse header ENTRA. Senha adivinhável,
// zero erro sinalizando o problema.
//
// Duas travas aqui:
//   1. comportamento — a função compartilhada recusa segredo ausente/vazio (4 casos);
//   2. estrutura — uma varredura do repo que quebra se a DÉCIMA rota voltar ao padrão antigo.
// A trava 2 é a que importa a longo prazo: sem ela a regressão volta pela próxima rota nova.

const API_DIR = fileURLToPath(new URL("../src/app/api/", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const SHARED_GUARD_IMPORT = '"@/lib/auth-bearer.mjs"';

// As 9 rotas que trocaram a guarda interpolada pela função compartilhada.
const GUARDED_ROUTES = [
  "src/app/api/cron/check-alerts/route.ts",
  "src/app/api/cron/sync-vturb/route.ts",
  "src/app/api/cron/slack-reminder/route.ts",
  "src/app/api/cron/sync-clickup/route.ts",
  "src/app/api/cron/sync-utmify/route.ts",
  "src/app/api/cron/weekly-scoreboard/route.ts",
  "src/app/api/admin/offer-domains/route.ts",
  "src/app/api/admin/offers/route.ts",
  "src/app/api/admin/sync-utmify-daily/route.ts",
];

// Rota que autentica CRON_SECRET por outro caminho, aceito de propósito:
// sync-ngv-core usa `secureEqual` (sha256 + timingSafeEqual) PRECEDIDO de `if (!expected || ...)`
// — ou seja, já é fail-closed, só que pela variante timing-safe. Não foi convertida porque
// trocar o esquema de comparação não é o escopo desta mudança. O teste abaixo exige que ela
// mantenha o gate de segredo vazio; se alguém remover o `!expected`, quebra aqui.
const FAIL_CLOSED_BY_EXPLICIT_GATE = new Map([
  ["src/app/api/cron/sync-ngv-core/route.ts", "if (!expected || !secureEqual("],
]);

// Rotas que delegam a guarda pro módulo puro (o módulo chama isAuthorizedBearer lá dentro).
// O caminho é fail-closed do mesmo jeito — o que muda é ONDE a comparação mora. Cada entrada
// exige a marca de que o segredo do ambiente ainda é REPASSADO pro delegado; quem apagar o
// repasse quebra aqui. Os dois lados (401 sem bearer / 200 com bearer certo) são provados nos
// testes do módulo: tests/admin-offer-lookup.test.mjs e tests/apps-admin-lookup-core.test.mjs.
const FAIL_CLOSED_BY_DELEGATION = new Map([
  ["src/app/api/admin/offers/lookup/route.ts", "cronSecret: process.env.CRON_SECRET"],
  ["src/app/api/admin/apps/lookup/route.ts", "secret: process.env.CRON_SECRET"],
]);

async function listRouteFiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listRouteFiles(full)));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") found.push(full);
  }
  return found;
}

async function routeSources() {
  const files = await listRouteFiles(API_DIR);
  files.sort();
  const out = [];
  for (const file of files) {
    out.push({
      rel: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
      src: await readFile(file, "utf8"),
    });
  }
  return out;
}

// ── 1. Comportamento: os 4 caminhos que o pedido exige ───────────────────────

const SECRET = "segredo-de-teste";

test("segredo AUSENTE (undefined/null): ninguém entra — nem com o literal 'Bearer undefined'", () => {
  for (const secret of [undefined, null]) {
    assert.equal(isAuthorizedBearer("Bearer undefined", secret), false);
    assert.equal(isAuthorizedBearer(`Bearer ${secret}`, secret), false);
    assert.equal(isAuthorizedBearer(`Bearer ${SECRET}`, secret), false);
    assert.equal(isAuthorizedBearer(null, secret), false);
  }
});

test("segredo VAZIO ou só espaço em branco: ninguém entra — nem mandando 'Bearer ' ou 'Bearer'", () => {
  for (const secret of ["", " ", "   ", "\t", "\n"]) {
    assert.equal(isAuthorizedBearer(`Bearer ${secret}`, secret), false);
    assert.equal(isAuthorizedBearer("Bearer ", secret), false);
    assert.equal(isAuthorizedBearer("Bearer", secret), false);
    assert.equal(isAuthorizedBearer("", secret), false);
    assert.equal(isAuthorizedBearer(null, secret), false);
  }
});

test("o literal 'Bearer undefined' é rejeitado mesmo com segredo configurado", () => {
  assert.equal(isAuthorizedBearer("Bearer undefined", SECRET), false);
  assert.equal(isAuthorizedBearer("Bearer null", SECRET), false);
  assert.equal(isAuthorizedBearer("Bearer NaN", SECRET), false);
});

test("segredo CERTO passa — o conserto não fecha a porta de quem chama hoje", () => {
  assert.equal(isAuthorizedBearer(`Bearer ${SECRET}`, SECRET), true);
});

test("formato do header não mudou: exige o prefixo 'Bearer ' exato, sem tolerância nova", () => {
  assert.equal(isAuthorizedBearer(SECRET, SECRET), false, "sem prefixo");
  assert.equal(isAuthorizedBearer(`bearer ${SECRET}`, SECRET), false, "minúsculo");
  assert.equal(isAuthorizedBearer(`Bearer  ${SECRET}`, SECRET), false, "espaço duplo");
  assert.equal(isAuthorizedBearer(`Bearer ${SECRET} `, SECRET), false, "espaço no fim");
  assert.equal(isAuthorizedBearer(`Basic ${SECRET}`, SECRET), false, "outro esquema");
  assert.equal(isAuthorizedBearer(`Bearer ${SECRET}x`, SECRET), false, "sufixo");
});

test("segredo com espaço nas pontas continua sendo comparado LITERAL (trim só decide se está vazio)", () => {
  // Cuidado deliberado: o trim existe pra detectar segredo em branco, NÃO pra normalizar
  // o valor. Se o operador configurar " abc ", quem entra é quem manda " abc " igualzinho —
  // trocar isso mudaria em silêncio quem consegue autenticar.
  const padded = " abc ";
  assert.equal(isAuthorizedBearer(`Bearer ${padded}`, padded), true);
  assert.equal(isAuthorizedBearer("Bearer abc", padded), false);
});

// ── 2. Uma regra só: lookup.mjs consome, não reimplementa ────────────────────

test("lookup.mjs reexporta a MESMA função de auth-bearer.mjs (não uma terceira cópia da regra)", () => {
  assert.equal(isAuthorizedBearerFromLookup, isAuthorizedBearer);
});

test("lookup.mjs não tem mais corpo próprio da guarda", async () => {
  const src = await readFile(new URL("../src/lib/offers/lookup.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(
    src,
    /export function isAuthorizedBearer/,
    "a definição deve morar só em src/lib/auth-bearer.mjs",
  );
  assert.match(src, /from "\.\.\/auth-bearer\.mjs"/);
});

// ── 3. Varredura do repo: a décima rota não volta ao padrão antigo ───────────

test("a varredura enxerga rotas de verdade (senão as travas abaixo passariam no vazio)", async () => {
  const routes = await routeSources();
  assert.ok(routes.length >= 20, `esperava ao menos 20 route.ts, achei ${routes.length}`);
  for (const rel of [
    ...GUARDED_ROUTES,
    ...FAIL_CLOSED_BY_EXPLICIT_GATE.keys(),
    ...FAIL_CLOSED_BY_DELEGATION.keys(),
  ]) {
    assert.ok(
      routes.some((r) => r.rel === rel),
      `rota listada no teste sumiu do disco: ${rel} (mova ou atualize a lista, não apague a trava)`,
    );
  }
});

// Pega os dois lados: `x !== \`Bearer ${process.env.Y}\`` e o espelho.
const ENV_IN_COMPARISON = [
  /(?:===|!==)\s*`[^`]*\$\{\s*process\.env\./,
  /`[^`]*\$\{\s*process\.env\.[^`]*`\s*(?:===|!==)/,
];

// Escrever `const s = process.env.X` e comparar `authHeader !== \`Bearer ${s}\`` é o MESMO
// defeito, só que uma variável adiante — ENV_IN_COMPARISON não pegaria. Este pega.
const BEARER_IN_COMPARISON = [/(?:===|!==)\s*`Bearer \$\{/, /`Bearer \$\{[^`]*`\s*(?:===|!==)/];

// A varredura só vale se os padrões dela realmente casarem com o bug. Sem esta trava,
// alguém "conserta" um falso-positivo enfraquecendo a regex, os dois testes de varredura
// continuam verdes pra sempre e a proteção vira decorativa.
test("os padrões da varredura casam com o bug de verdade (e não com as formas aceitas)", () => {
  const deveCasar = [
    "  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {",
    "  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {",
    "if (`Bearer ${process.env.CRON_SECRET}` !== authHeader) {",
    "  if (authHeader !== `Bearer ${ process.env.OUTRO_SEGREDO }`) {",
    "  const s = process.env.X;\n  if (authHeader !== `Bearer ${s}`) {",
    "  if (`Bearer ${expected}` === authHeader) {",
  ];
  for (const amostra of deveCasar) {
    const pego =
      ENV_IN_COMPARISON.some((re) => re.test(amostra)) ||
      BEARER_IN_COMPARISON.some((re) => re.test(amostra));
    assert.ok(pego, `padrão fail-open passou batido pela varredura: ${amostra}`);
  }

  const naoDeveCasar = [
    "  if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {",
    "  if (!expected || !secureEqual(authHeader, `Bearer ${expected}`)) {",
    "  if (webhookSecret !== process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) {",
    '  headers: { Authorization: `Bearer ${apiKey}` },',
  ];
  for (const amostra of naoDeveCasar) {
    const pego =
      ENV_IN_COMPARISON.some((re) => re.test(amostra)) ||
      BEARER_IN_COMPARISON.some((re) => re.test(amostra));
    assert.equal(pego, false, `falso positivo da varredura: ${amostra}`);
  }
});

test("NENHUMA rota compara header contra template literal que interpola process.env (padrão fail-open)", async () => {
  const offenders = [];
  for (const { rel, src } of await routeSources()) {
    if (ENV_IN_COMPARISON.some((re) => re.test(src))) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    "variável ausente vira a string 'undefined' dentro do template e a comparação passa a aceitar " +
      "um header adivinhável — use isAuthorizedBearer de @/lib/auth-bearer.mjs",
  );
});

test("NENHUMA rota compara header contra template `Bearer ${...}` com ===/!== (mesmo bug via variável)", async () => {
  const offenders = [];
  for (const { rel, src } of await routeSources()) {
    if (BEARER_IN_COMPARISON.some((re) => re.test(src))) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], "compare com isAuthorizedBearer(authHeader, segredo)");
});

test("toda rota que lê process.env.CRON_SECRET é fail-closed por um caminho conhecido", async () => {
  const semGuarda = [];
  let conferidas = 0;
  for (const { rel, src } of await routeSources()) {
    if (!src.includes("process.env.CRON_SECRET")) continue;
    conferidas++;
    const gate = FAIL_CLOSED_BY_EXPLICIT_GATE.get(rel) ?? FAIL_CLOSED_BY_DELEGATION.get(rel);
    if (gate) {
      assert.ok(src.includes(gate), `${rel} perdeu o gate de segredo ausente: ${gate}`);
      continue;
    }
    if (!src.includes(SHARED_GUARD_IMPORT) || !src.includes("isAuthorizedBearer(")) {
      semGuarda.push(rel);
    }
  }
  assert.deepEqual(semGuarda, []);
  // Conferência de contagem: 9 convertidas + sync-ngv-core + offers/lookup + apps/lookup.
  assert.equal(conferidas, GUARDED_ROUTES.length + 3, `rotas com CRON_SECRET: ${conferidas}`);
});

// ── 4. As 9 rotas, uma a uma ─────────────────────────────────────────────────

for (const rel of GUARDED_ROUTES) {
  test(`${rel}: guarda de Bearer é a compartilhada e responde 401`, async () => {
    const src = await readFile(new URL(`../${rel}`, import.meta.url), "utf8");

    assert.ok(
      src.includes(`import { isAuthorizedBearer } from ${SHARED_GUARD_IMPORT};`),
      "deve importar a guarda compartilhada",
    );

    const guard = "if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {";
    const idx = src.indexOf(guard);
    assert.ok(idx >= 0, "deve usar a guarda compartilhada com CRON_SECRET");
    assert.equal(src.split(guard).length - 1, 1, "uma guarda só por rota");

    // O 401 e a mensagem não mudaram: quem chama certo hoje continua vendo o mesmo contrato.
    const janela = src.slice(idx, idx + 200);
    assert.match(janela, /status: 401/);
    assert.match(janela, /"Unauthorized"/);

    // O nome da variável de ambiente não mudou — Vercel Cron e integrações externas
    // continuam mandando o mesmo header, sem alteração nenhuma do lado deles.
    assert.match(src, /process\.env\.CRON_SECRET/);
  });
}
