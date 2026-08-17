import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-vturb/route.ts", import.meta.url);

async function source() {
  return readFile(ROUTE_PATH, "utf8");
}

test("VTURB_API_KEY ausente responde com status 500 (não mais 200 mascarado)", async () => {
  const src = await source();
  const idx = src.indexOf('"VTURB_API_KEY not configured"');
  assert.ok(idx >= 0, "mensagem original deve continuar existindo");
  const window = src.slice(idx, idx + 150);
  assert.match(window, /status: 500/);
});

test("falha de rede (fetchPlayers/fetchEventsByPlayer) responde com status 500", async () => {
  const src = await source();
  const idx = src.indexOf("success: false, error: msg");
  assert.ok(idx >= 0, "catch-all deve continuar existindo");
  const window = src.slice(idx, idx + 100);
  assert.match(window, /status: 500/);
});

test("só existem 2 respostas com status 500 no arquivo — nenhuma outra ganhou 5xx", async () => {
  const src = await source();
  assert.equal((src.match(/status: 500/g) ?? []).length, 2);
});

test("catch por player (retry-unsafe: insert sem onConflict) continua sem virar resposta 5xx", async () => {
  const src = await source();
  const idx = src.indexOf('results.push({ player: player.name, status: "error", error: msg });');
  assert.ok(idx >= 0);
  // Nada de NextResponse nem status 5xx perto do catch por-player: ele só registra no array.
  const window = src.slice(Math.max(0, idx - 200), idx + 50);
  assert.doesNotMatch(window, /NextResponse\.json/);
});

test("gate de VTURB_API_KEY ausente dispara antes de qualquer db.insert (retry seguro, insert sem onConflict)", async () => {
  const src = await source();
  const firstInsertIdx = src.indexOf("await db.insert(metricsSnapshots).values({");
  const configGateIdx = src.indexOf('"VTURB_API_KEY not configured"');
  assert.ok(configGateIdx >= 0 && firstInsertIdx > configGateIdx, "gate de config ausente deve vir antes do insert");
});

// --- Trava de regressão: catch por-player nunca pode relançar (dívida apontada pelo QA) ---
//
// A invariante "catch externo do vturb só dispara pré-insert" (comentário em route.ts, perto
// da resposta 500 do catch-all) depende de UM fato estrutural: o catch do laço por-player
// (dentro do `for (const player of allToSave)`) captura o erro e só empurra pra `results[]`
// — ele NUNCA relança. Se algum dia esse catch passar a `throw`/`reject` o erro capturado,
// o erro escaparia pro catch externo (route.ts ~129-134) DEPOIS que iterações anteriores do
// MESMO loop já rodaram `db.insert()` — e esse insert não tem `onConflictDoNothing` (diferente
// do sync-utmify). A plataforma reagenda a rotina no 500 recebido, e cada retry duplica as
// linhas que já foram salvas antes do relançamento. É um defeito silencioso: os números só
// incham, sem erro visível pra ninguém notar.
//
// Isola o CORPO do catch por-player caminhando pelas chaves de verdade (contagem de
// profundidade), não por um recorte fixo de caracteres — sobrevive a reformatação inocente
// (comentário novo, linha quebrada, reindentação) mas ainda pega a regressão real porque o
// corte é sempre exatamente "do abre-chaves do catch até o fecha-chaves que casa com ele".
function extractBlockBody(src, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openBraceIdx + 1, i);
    }
  }
  return null;
}

test("catch por-player NUNCA relança o erro capturado (evita 500 pós-insert e duplicação silenciosa de linha)", async () => {
  const src = await source();

  // Âncora: a linha que hoje é o ÚNICO destino do erro capturado no laço por-player.
  const pushIdx = src.indexOf(
    'results.push({ player: player.name, status: "error", error: msg });',
  );
  assert.ok(pushIdx >= 0, "catch por-player deve continuar existindo (results.push do erro)");

  // O "catch (err) {" mais próximo ANTES dessa linha é o catch por-player (o outro catch
  // "catch (err) {" do arquivo, o externo, vem DEPOIS — não interfere na busca pra trás).
  const catchKeywordIdx = src.lastIndexOf("catch (err) {", pushIdx);
  assert.ok(catchKeywordIdx >= 0, "abertura do catch por-player não encontrada");

  const openBraceIdx = src.indexOf("{", catchKeywordIdx);
  const catchBody = extractBlockBody(src, openBraceIdx);
  assert.ok(catchBody !== null, "não foi possível isolar o corpo do catch por-player (chaves desbalanceadas?)");

  // Sanidade: garante que isolamos o bloco CERTO (o que contém o results.push âncora), não
  // outro catch do arquivo (ex.: o catch do fetchSessionStats, mais acima no arquivo).
  assert.ok(
    catchBody.includes('results.push({ player: player.name, status: "error", error: msg })'),
    "bloco isolado não é o catch por-player esperado — âncora não encontrada dentro dele",
  );

  const failMsg =
    "REGRESSÃO: catch por-player passou a relançar o erro. Isso quebra a invariante que " +
    "protege o cron de duplicar dado — com relançamento, o erro escapa pro catch externo " +
    "DEPOIS que db.insert() (sem onConflictDoNothing) já rodou pra players anteriores no " +
    "mesmo loop; retry da plataforma no 500 duplica essas linhas em silêncio. Reverta pra " +
    "capturar-e-registrar em results[], sem throw/reject.";

  assert.doesNotMatch(catchBody, /\bthrow\b/, failMsg);
  assert.doesNotMatch(catchBody, /\breject\s*\(/, failMsg);
});
