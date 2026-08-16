import assert from "node:assert/strict";
import test from "node:test";
import {
  avaliarOferta,
  avaliarTodasOfertas,
  ordemLeitura,
  porDia,
  resumoOfertas,
  serieDaOferta,
  situacaoOferta,
  veredictoDaNota,
} from "../src/components/sistemas/spy/avaliacao.mjs";

// Todos os números "esperados" abaixo foram gerados RODANDO — não de memória — as funções `dt`,
// `clamp`, `media`, `serie`, `porDia`, `avaliar`, `situacao`, `veredito` extraídas VERBATIM de
// workspaces/spy-analytics/index.html:644-722 sobre os MESMOS fixtures deste arquivo (script usado
// pra gerar: /tmp/.../extract-original.mjs, descartável, não versionado — só o resultado importa
// aqui). Se algum número deste arquivo divergir da fórmula do original, é ESTE teste que está
// errado, nunca o contrário — recompute rodando o original de novo antes de "corrigir" um valor.

const PESOS = { estab: 45, vol: 30, tempo: 25 };

function leitura(ofertaId, data, periodo, ads) {
  return { id: `${ofertaId}-${data}-${periodo}`, ofertaId, data, periodo, ads };
}

test("ordemLeitura: mesma data, noite sempre depois de manhã", () => {
  assert.equal(ordemLeitura({ data: "2026-08-10", periodo: "manha" }), "2026-08-10A");
  assert.equal(ordemLeitura({ data: "2026-08-10", periodo: "noite" }), "2026-08-10B");
  assert.ok(ordemLeitura({ data: "2026-08-10", periodo: "manha" }) < ordemLeitura({ data: "2026-08-10", periodo: "noite" }));
});

test("serieDaOferta: filtra pela oferta e ordena cronologicamente (mesmo se a entrada vier fora de ordem)", () => {
  const leituras = [
    leitura("a", "2026-08-02", "manha", 10),
    leitura("b", "2026-08-01", "manha", 999), // de outra oferta — não deve entrar
    leitura("a", "2026-08-01", "noite", 12),
    leitura("a", "2026-08-01", "manha", 11),
  ];
  const s = serieDaOferta(leituras, "a");
  assert.deepEqual(s.map((l) => `${l.data}-${l.periodo}`), ["2026-08-01-manha", "2026-08-01-noite", "2026-08-02-manha"]);
});

test("porDia: agrupa por data tirando a média de manhã+noite", () => {
  const s = serieDaOferta([leitura("a", "2026-08-01", "manha", 10), leitura("a", "2026-08-01", "noite", 20)], "a");
  assert.deepEqual(porDia(s), [{ data: "2026-08-01", ads: 15 }]);
});

test("caso 1 — poucas leituras (n<4): nota penalizada em 12% e veredito trava em 'acompanhar mais'", () => {
  const oferta = { id: "poucas" };
  const leituras = [leitura("poucas", "2026-08-10", "manha", 80), leitura("poucas", "2026-08-10", "noite", 90)];

  const a = avaliarOferta(oferta, leituras, PESOS, 20, 90);

  assert.equal(a.n, 2);
  assert.equal(a.pouco, true);
  assert.equal(a.atual, 90);
  assert.equal(a.delta, 10);
  assert.equal(a.nota, 69); // extraído do original: (45*100+30*100+25*13)/100 = 78.25 * 0.88 = 68.86 -> 69
  assert.equal(a.estab, 100);
  assert.equal(a.vol, 100);
  assert.equal(a.tempo, 13);

  assert.deepEqual(situacaoOferta(a), { classe: "pouco", txt: "pouco dado" });
  // "pouco" TRAVA o veredito em "acompanhar mais" mesmo a nota (69) caindo na faixa de "candidata
  // forte" (>=60) — é o caso que prova que `pouco` sobrepõe o corte numérico, não só reduz a nota.
  assert.deepEqual(veredictoDaNota(a.nota, a.pouco), { txt: "acompanhar mais", tom: "neutro" });
});

test("caso 2 — queda de anúncios: pico de 200 despenca pra ~55, sai de escala e nota reflete a queda", () => {
  const oferta = { id: "queda" };
  const leituras = [
    leitura("queda", "2026-08-01", "manha", 150),
    leitura("queda", "2026-08-01", "noite", 180),
    leitura("queda", "2026-08-02", "manha", 200),
    leitura("queda", "2026-08-02", "noite", 195),
    leitura("queda", "2026-08-03", "manha", 60),
    leitura("queda", "2026-08-03", "noite", 55),
  ];

  const a = avaliarOferta(oferta, leituras, PESOS, 20, 55);

  assert.equal(a.n, 6);
  assert.equal(a.atual, 55);
  assert.equal(a.delta, -5);
  assert.equal(a.pico, 200);
  assert.equal(a.seqAtual, 0);
  assert.deepEqual([...a.foraEscala], ["2026-08-03"]);
  assert.equal(a.nota, 55);
  assert.equal(a.estab, 37);
  assert.equal(a.vol, 100);
  assert.equal(a.tempo, 35);

  // atual/pico = 55/200 = 0.275 < 0.5 -> "descontinuando" (morrendo), não só "saiu de escala"
  assert.deepEqual(situacaoOferta(a), { classe: "morrendo", txt: "descontinuando" });
  assert.deepEqual(veredictoDaNota(a.nota, a.pouco), { txt: "observar", tom: "alerta" });
});

test("caso 3 — oferta estável: mantém o patamar em todos os dias registrados, nota alta, veredito 'traduzir'", () => {
  const oferta = { id: "estavel" };
  const leituras = [
    leitura("estavel", "2026-08-01", "manha", 100),
    leitura("estavel", "2026-08-01", "noite", 102),
    leitura("estavel", "2026-08-02", "manha", 101),
    leitura("estavel", "2026-08-02", "noite", 103),
    leitura("estavel", "2026-08-03", "manha", 104),
    leitura("estavel", "2026-08-03", "noite", 105),
    leitura("estavel", "2026-08-04", "manha", 103),
    leitura("estavel", "2026-08-04", "noite", 106),
  ];

  const a = avaliarOferta(oferta, leituras, PESOS, 20, 106);

  assert.equal(a.n, 8);
  assert.equal(a.pouco, false);
  assert.equal(a.seqAtual, a.diasReg); // nunca quebrou a escala
  assert.equal(a.nota, 86);
  assert.equal(a.estab, 100);
  assert.equal(a.vol, 100);
  assert.equal(a.tempo, 44);

  assert.deepEqual(situacaoOferta(a), { classe: "estavel", txt: "em escala" });
  assert.deepEqual(veredictoDaNota(a.nota, a.pouco), { txt: "traduzir", tom: "sucesso" });
});

test("caso 4 — tolerância muda o veredito: MESMOS dados, só a tolerância varia, e o veredito muda de categoria", () => {
  const oferta = { id: "tol" };
  const leituras = [
    leitura("tol", "2026-08-01", "manha", 190),
    leitura("tol", "2026-08-01", "noite", 200),
    leitura("tol", "2026-08-02", "manha", 195),
    leitura("tol", "2026-08-02", "noite", 198),
    leitura("tol", "2026-08-03", "manha", 130), // dia de queda: 35% abaixo do pico (200)
    leitura("tol", "2026-08-03", "noite", 135),
    leitura("tol", "2026-08-04", "manha", 190),
    leitura("tol", "2026-08-04", "noite", 195),
  ];

  // tolerância apertada (20%): só aceita até 20% abaixo do pico corrido (>=160) — o dia de 130/135
  // fica FORA de escala, quebra a sequência, e a nota cai pra "candidata forte" (60-74).
  const apertada = avaliarOferta(oferta, leituras, PESOS, 20, 195);
  assert.equal(apertada.emEscala, 3);
  assert.equal(apertada.seqAtual, 1);
  assert.deepEqual([...apertada.foraEscala], ["2026-08-03"]);
  assert.equal(apertada.nota, 65);
  assert.deepEqual(situacaoOferta(apertada), { classe: "caindo", txt: "oscilando" });
  assert.deepEqual(veredictoDaNota(apertada.nota, apertada.pouco), { txt: "candidata forte", tom: "info" });

  // tolerância frouxa (40%): aceita até 40% abaixo do pico corrido (>=120) — o MESMO dia de
  // 130/135 agora fica DENTRO de escala, a sequência nunca quebra, e o veredito sobe pra
  // "traduzir" (>=75). Prova que a tolerância (parâmetro do time, não os dados) decide a categoria.
  const frouxa = avaliarOferta(oferta, leituras, PESOS, 40, 195);
  assert.equal(frouxa.emEscala, 4);
  assert.equal(frouxa.seqAtual, 4);
  assert.deepEqual([...frouxa.foraEscala], []);
  assert.equal(frouxa.nota, 86);
  assert.deepEqual(situacaoOferta(frouxa), { classe: "estavel", txt: "em escala" });
  assert.deepEqual(veredictoDaNota(frouxa.nota, frouxa.pouco), { txt: "traduzir", tom: "sucesso" });
});

test("avaliarOferta: oferta sem nenhuma leitura devolve o objeto vazio (nota 0, pouco=true, sem lançar)", () => {
  const a = avaliarOferta({ id: "sem-leitura" }, [], PESOS, 20, 40);
  assert.equal(a.n, 0);
  assert.equal(a.nota, 0);
  assert.equal(a.pouco, true);
  assert.equal(a.ultima, null);
  assert.deepEqual(situacaoOferta(a), { classe: "pouco", txt: "sem leitura" });
});

test("avaliarTodasOfertas: teto de volume é COMPARTILHADO (log satura contra o maior 'atual' de todas, não só o próprio)", () => {
  const ofertas = [{ id: "pequena" }, { id: "grande" }];
  const leituras = [
    leitura("pequena", "2026-08-01", "manha", 50),
    leitura("pequena", "2026-08-01", "noite", 50),
    leitura("grande", "2026-08-01", "manha", 500),
    leitura("grande", "2026-08-01", "noite", 500),
  ];
  const mapa = avaliarTodasOfertas(ofertas, leituras, PESOS, 20);

  // teto = max(40, 50, 500) = 500 — o "vol" da oferta pequena usa o MESMO teto que a grande,
  // então fica bem mais baixo do que ficaria se cada oferta saturasse contra o próprio pico.
  const vozIsolada = avaliarOferta({ id: "pequena" }, leituras, PESOS, 20, 50).vol;
  assert.equal(mapa.pequena.vol < vozIsolada, true, "vol deve cair quando comparado contra o teto global, não o próprio pico");
  assert.equal(mapa.grande.vol, 100); // a maior "atual" do grupo sempre bate 100 no vol (log(1+teto)/log(1+teto))
});

test("resumoOfertas: reproduz os 4 KPIs do Painel original (index.html:794-803)", () => {
  const ofertas = [{ id: "a", nome: "Oferta A" }, { id: "b", nome: "Oferta B" }, { id: "c", nome: "Oferta C" }];
  const leituras = [
    // A: estável, nota alta (>=75) -> conta em "prontas" e "sem quebra"
    leitura("a", "2026-08-01", "manha", 100),
    leitura("a", "2026-08-01", "noite", 101),
    leitura("a", "2026-08-02", "manha", 102),
    leitura("a", "2026-08-02", "noite", 103),
    leitura("a", "2026-08-03", "manha", 104),
    leitura("a", "2026-08-03", "noite", 105),
    leitura("a", "2026-08-04", "manha", 106),
    leitura("a", "2026-08-04", "noite", 107),
    // B: poucas leituras -> não conta em "prontas" nem "sem quebra" mesmo com atual alto
    leitura("b", "2026-08-01", "manha", 90),
    // C: sem nenhuma leitura -> fora de "comDados" inteiramente
  ];
  const mapa = avaliarTodasOfertas(ofertas, leituras, PESOS, 20);
  const resumo = resumoOfertas(ofertas, mapa);

  assert.equal(resumo.totalAds, mapa.a.atual + mapa.b.atual); // soma só quem tem leitura (c fica de fora)
  assert.equal(resumo.prontas, 1); // só "a" (nota>=75 e não "pouco")
  assert.equal(resumo.semQuebra, 1); // só "a" (seqAtual===diasReg e não "pouco")
  assert.equal(resumo.lider.id, "a"); // maior nota do conjunto passado
});

test("resumoOfertas: lider segue a MESMA lista recebida (respeita filtro), não recalcula sobre todas as ofertas", () => {
  const ofertas = [{ id: "a", nome: "Oferta A" }, { id: "b", nome: "Oferta B" }];
  const leituras = [
    leitura("a", "2026-08-01", "manha", 200),
    leitura("a", "2026-08-01", "noite", 205),
    leitura("a", "2026-08-02", "manha", 210),
    leitura("a", "2026-08-02", "noite", 208),
    leitura("b", "2026-08-01", "manha", 10),
    leitura("b", "2026-08-01", "noite", 10),
    leitura("b", "2026-08-02", "manha", 10),
    leitura("b", "2026-08-02", "noite", 10),
  ];
  const mapa = avaliarTodasOfertas(ofertas, leituras, PESOS, 20);

  // sem filtro: líder é "a" (nota mais alta)
  assert.equal(resumoOfertas(ofertas, mapa).lider.id, "a");
  // com "a" filtrada fora da lista (ex.: filtro de nicho excluiu), líder passa a ser "b" mesmo "a"
  // continuando com nota mais alta no mapa inteiro — prova que resumoOfertas nunca ignora o filtro.
  assert.equal(resumoOfertas([ofertas[1]], mapa).lider.id, "b");
});

test("resumoOfertas: lista vazia devolve lider null sem lançar", () => {
  const resumo = resumoOfertas([], {});
  assert.deepEqual(resumo, { totalAds: 0, prontas: 0, semQuebra: 0, lider: null });
});
