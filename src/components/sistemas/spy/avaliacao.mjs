// Núcleo puro da nota/veredito/estabilidade do Painel do Spy Analytics — porta EXATA da matemática
// de workspaces/spy-analytics/index.html:644-722 (funções `dt`, `clamp`, `media`, `serie`, `porDia`,
// `avaliar`, `situacao`, `veredito`, `avaliarTodas`). Mesma fórmula, byte a byte, com uma única
// mudança estrutural: no original tudo lê globals (`S.leituras`, `S.pesos`, `S.tolerancia`); aqui
// tudo é parâmetro explícito, porque este módulo não tem estado próprio — quem chama é sempre um
// componente React que já tem `SpyModuleEstadoData` em mãos.
//
// NÃO mexa nos números sem recomparar com o original (ver tests/sistemas-spy-avaliacao.test.mjs —
// os fixtures de lá foram gerados RODANDO a função `avaliar` extraída verbatim do index.html, não
// de memória). Um número de nota errado é pior que a aba não existir: o operador olha um ranking
// que mente e escolhe a oferta errada pra modelar.
//
// Sem `import "server-only"` de propósito — roda no client (é math de UI), mesma convenção dos
// outros .mjs de src/components/sistemas/ e src/lib/sistemas/ que precisam ser testáveis via
// `node --test` sem runtime React.

/**
 * Chave de ordenação cronológica de uma leitura: mesma data, "noite" sempre depois de "manhã".
 * Idêntico a `ordemLeitura` do original (index.html:647).
 */
export function ordemLeitura(leitura) {
  return leitura.data + (leitura.periodo === "manha" ? "A" : "B");
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const media = (valores) => valores.reduce((x, y) => x + y, 0) / valores.length;
const dataDoDia = (iso) => new Date(iso + "T00:00:00");

/**
 * Todas as leituras de uma oferta, em ordem cronológica. Idêntico a `serie` do original
 * (index.html:648), só que recebendo `leituras` como parâmetro em vez de ler `S.leituras`.
 */
export function serieDaOferta(leituras, ofertaId) {
  return leituras
    .filter((l) => l.ofertaId === ofertaId)
    .sort((a, b) => (ordemLeitura(a) < ordemLeitura(b) ? -1 : 1));
}

/**
 * Agrupa a série por dia, tirando a média das leituras do mesmo dia (manhã+noite). Idêntico a
 * `porDia` do original (index.html:656-660). Usado tanto pela nota (estabilidade) quanto pelo
 * gráfico no modo "Média do dia".
 */
export function porDia(serie) {
  const porData = {};
  serie.forEach((l) => (porData[l.data] = porData[l.data] || []).push(l.ads));
  return Object.keys(porData)
    .sort()
    .map((data) => ({ data, ads: media(porData[data]) }));
}

const AVALIACAO_VAZIA = Object.freeze({
  n: 0,
  atual: 0,
  dias: 0,
  diasReg: 0,
  emEscala: 0,
  seqAtual: 0,
  razao: 1,
  pico: 0,
  nota: 0,
  estab: 0,
  vol: 0,
  tempo: 0,
  pouco: true,
  delta: 0,
  ultima: null,
});

/**
 * Avalia uma oferta: nota 0-100 e os três componentes (estabilidade/volume/tempo) que a compõem,
 * mais os dados de apoio pro veredito e pra situação (badge de status). Porta EXATA de `avaliar`
 * do original (index.html:662-698) — mesma matemática, mesmos nomes de variável internos.
 *
 * @param {{id:string}} oferta
 * @param {Array} leituras — todas as leituras (de todas as ofertas); filtra internamente pela oferta.
 * @param {{estab:number,vol:number,tempo:number}} pesos
 * @param {number} tolerancia — percentual (ex.: 20 = tolera até 20% abaixo do pico corrido).
 * @param {number} tetoVolume — teto usado no log do componente de volume (vem de `avaliarTodasOfertas`).
 */
export function avaliarOferta(oferta, leituras, pesos, tolerancia, tetoVolume) {
  const s = serieDaOferta(leituras, oferta.id);
  if (!s.length) return { serie: s, foraEscala: new Set(), ...AVALIACAO_VAZIA };

  const vals = s.map((x) => x.ads);
  const atual = vals[vals.length - 1];
  const anterior = vals.length > 1 ? vals[vals.length - 2] : atual;

  // estabilidade: dias mantidos em escala (dentro da tolerância do pico corrido até então)
  const diasAgrupados = porDia(s);
  const tol = 1 - tolerancia / 100;
  const foraEscala = new Set();
  let picoCorrido = 0;
  let emEscala = 0;
  let seq = 0;
  diasAgrupados.forEach((d) => {
    const dentro = picoCorrido === 0 ? true : d.ads >= picoCorrido * tol;
    if (dentro) {
      emEscala++;
      seq++;
    } else {
      seq = 0;
      foraEscala.add(d.data);
    }
    picoCorrido = Math.max(picoCorrido, d.ads);
  });
  const diasReg = diasAgrupados.length;
  const estab = 100 * (0.55 * (emEscala / diasReg) + 0.45 * (seq / diasReg));

  const dias = Math.round((dataDoDia(s[s.length - 1].data) - dataDoDia(s[0].data)) / 864e5) + 1;
  const tempo = 100 * (1 - Math.exp(-dias / 7));
  const vol = clamp((100 * Math.log(1 + atual)) / Math.log(1 + Math.max(tetoVolume, 40)), 0, 100);

  const soma = pesos.estab + pesos.vol + pesos.tempo || 1;
  let nota = (pesos.estab * estab + pesos.vol * vol + pesos.tempo * tempo) / soma;
  const pouco = s.length < 4;
  if (pouco) nota *= 0.88;

  return {
    serie: s,
    n: s.length,
    atual,
    dias,
    diasReg,
    emEscala,
    seqAtual: seq,
    foraEscala,
    razao: diasAgrupados[0].ads > 0 ? diasAgrupados[diasAgrupados.length - 1].ads / diasAgrupados[0].ads : 1,
    pico: Math.max(...vals),
    nota: Math.round(nota),
    estab: Math.round(estab),
    vol: Math.round(vol),
    tempo: Math.round(tempo),
    pouco,
    delta: atual - anterior,
    ultima: s[s.length - 1],
  };
}

/**
 * Badge de situação (selo colorido no card do ranking). Porta EXATA de `situacao` do original
 * (index.html:700-709). `classe` é um identificador estável — o componente React mapeia pra tom
 * visual (o original usava CSS var direta; aqui não há esse tema, então o mapeamento pra cor vive
 * no componente, não aqui).
 */
export function situacaoOferta(a) {
  if (!a.n) return { classe: "pouco", txt: "sem leitura" };
  if (a.pouco) return { classe: "pouco", txt: "pouco dado" };
  if (a.seqAtual === 0) {
    return a.atual / (a.pico || 1) < 0.5
      ? { classe: "morrendo", txt: "descontinuando" }
      : { classe: "caindo", txt: "saiu de escala" };
  }
  if (a.seqAtual === a.diasReg) {
    return a.razao >= 1.15 ? { classe: "subindo", txt: "escalando" } : { classe: "estavel", txt: "em escala" };
  }
  if (a.seqAtual >= a.diasReg * 0.6) return { classe: "estavel", txt: "retomou escala" };
  return { classe: "caindo", txt: "oscilando" };
}

/**
 * Veredito textual a partir da nota. Porta EXATA dos cortes de `veredito` do original
 * (index.html:710-716): >=75 traduzir, >=60 candidata forte, >=45 observar, resto descartar —
 * com `pouco` (menos de 4 leituras) sobrepondo tudo isso pra "acompanhar mais". `tom` substitui a
 * cor CSS var do original (`cor: C('--subindo')` etc.) por um identificador que o componente React
 * mapeia pra `StatusBadge`/classe Tailwind — o corte numérico é o que importa pra fidelidade.
 */
export function veredictoDaNota(nota, pouco) {
  if (pouco) return { txt: "acompanhar mais", tom: "neutro" };
  if (nota >= 75) return { txt: "traduzir", tom: "sucesso" };
  if (nota >= 60) return { txt: "candidata forte", tom: "info" };
  if (nota >= 45) return { txt: "observar", tom: "alerta" };
  return { txt: "descartar", tom: "perigo" };
}

/**
 * Avalia todas as ofertas de uma vez, calculando o teto de volume compartilhado (o log do
 * componente "vol" satura contra o maior "atual" de qualquer oferta, não só a própria). Porta
 * EXATA de `avaliarTodas` do original (index.html:717-722).
 *
 * @returns {Record<string, ReturnType<typeof avaliarOferta>>} mapa ofertaId -> avaliação.
 */
export function avaliarTodasOfertas(ofertas, leituras, pesos, tolerancia) {
  const teto = Math.max(
    40,
    ...ofertas.map((o) => {
      const s = serieDaOferta(leituras, o.id);
      return s.length ? s[s.length - 1].ads : 0;
    }),
  );
  const mapa = {};
  ofertas.forEach((o) => {
    mapa[o.id] = avaliarOferta(o, leituras, pesos, tolerancia, teto);
  });
  return mapa;
}

/**
 * Os 4 KPIs do Painel original (index.html:794-803): total de anúncios monitorados (soma do
 * "atual" de cada oferta com leitura), quantas estão prontas pra traduzir (nota>=75, com dado
 * suficiente), quantas seguraram a escala sem quebra (seqAtual===diasReg), e a líder da lista
 * recebida (maior nota) — "líder" segue a MESMA lista passada (pode ser filtrada ou não, igual ao
 * original: `lider` sai de `lista`, não de "todas as ofertas").
 *
 * @template {{id:string}} T
 * @param {T[]} ofertas — o conjunto sobre o qual calcular (filtrado ou completo).
 * @param {Record<string, ReturnType<typeof avaliarOferta>>} mapa — de `avaliarTodasOfertas`, SEMPRE
 *   calculado sobre o conjunto COMPLETO (o teto de volume é global), mesmo quando `ofertas` aqui é
 *   um subconjunto filtrado.
 * @returns {{totalAds:number, prontas:number, semQuebra:number, lider:T|null}}
 */
export function resumoOfertas(ofertas, mapa) {
  const comDados = ofertas.filter((o) => mapa[o.id]?.n > 0);
  const totalAds = comDados.reduce((soma, o) => soma + mapa[o.id].atual, 0);
  const prontas = comDados.filter((o) => !mapa[o.id].pouco && mapa[o.id].nota >= 75).length;
  const semQuebra = comDados.filter((o) => !mapa[o.id].pouco && mapa[o.id].seqAtual === mapa[o.id].diasReg).length;
  const lider = ofertas.length
    ? [...ofertas].sort((a, b) => mapa[b.id].nota - mapa[a.id].nota)[0]
    : null;
  return { totalAds, prontas, semQuebra, lider };
}
