// Núcleo puro da aba "Leitura do dia" — porta EXATA da lógica de
// workspaces/spy-analytics/index.html:862-895 (renderLeitura/movimento) e :1455-1470
// (btnSalvarLeitura). Mesma convenção de avaliacao.mjs: sem estado próprio, sem DOM, tudo
// parâmetro explícito — testável via `node --test` sem runtime React.
//
// Reusa `ordemLeitura`/`serieDaOferta` de avaliacao.mjs (REUSE, não duplica a chave de ordenação
// cronológica que já existe e já foi validada contra o original).

import { ordemLeitura, serieDaOferta } from "./avaliacao.mjs";

/** Mesma chave `data + (manha?'A':'B')` usada em toda comparação cronológica do módulo Spy. */
export function chaveOrdem(data, periodo) {
  return data + (periodo === "manha" ? "A" : "B");
}

/** Leitura já registrada para esta oferta+data+período, ou null. */
export function leituraExistente(leituras, ofertaId, data, periodo) {
  return leituras.find((l) => l.ofertaId === ofertaId && l.data === data && l.periodo === periodo) ?? null;
}

/**
 * Última leitura ANTERIOR a data+período (mesma regra do original: `ordemLeitura(l) <
 * data+per`). É o valor mostrado na coluna "Anterior" e usado pra calcular o movimento.
 */
export function leituraAnterior(leituras, ofertaId, data, periodo) {
  const alvo = chaveOrdem(data, periodo);
  const serie = serieDaOferta(leituras, ofertaId).filter((l) => ordemLeitura(l) < alvo);
  return serie.length ? serie[serie.length - 1] : null;
}

/**
 * Delta e variação percentual entre o valor digitado (string do input) e a leitura anterior.
 * Campo em branco ou sem leitura anterior devolve null — idêntico ao "—" do original
 * (index.html:892: `if(inp.value === '' || ant === null){ ... '—' ... }`).
 */
export function calcularMovimento(valorTexto, anteriorAds) {
  if (valorTexto === "" || valorTexto === undefined || valorTexto === null) return null;
  if (anteriorAds === null || anteriorAds === undefined) return null;
  const atual = Number(valorTexto);
  if (!Number.isFinite(atual)) return null;
  const delta = atual - anteriorAds;
  const pct = anteriorAds ? Math.round((delta / anteriorAds) * 100) : 0;
  return { delta, pct };
}

/**
 * true quando TODAS as ofertas já têm leitura pra esta data+período — aviso "já registrada para
 * todas as ofertas, salvar de novo sobrescreve" (index.html:881-883). Lista vazia de ofertas nunca
 * é "completa" (nada pra completar).
 */
export function leituraCompletaParaTodas(ofertas, leituras, data, periodo) {
  if (!ofertas.length) return false;
  return ofertas.every((o) => leituraExistente(leituras, o.id, data, periodo) !== null);
}

/**
 * Monta os itens do lote pra `saveSpyLeiturasBatchWithAudit` a partir do mapa
 * `{ ofertaId: valorDigitado }`. Campo em branco (`''`/undefined) NUNCA entra no lote — mesma
 * regra do original (index.html:1460: `if(inp.value === '') return;`). Reusa o id da leitura
 * quando ela já existe (upsert), gera um novo id só pra leitura nova.
 *
 * `gerarId` é injetado (não chama crypto.randomUUID() direto) pra manter esta função pura e
 * determinística em teste — no componente real o caller passa `() => crypto.randomUUID()`.
 */
export function montarItensLote({ ofertas, leituras, data, periodo, valores, gerarId }) {
  const itens = [];
  for (const oferta of ofertas) {
    const bruto = valores[oferta.id];
    if (bruto === undefined || bruto === "") continue;
    const numero = Number(bruto);
    if (!Number.isFinite(numero)) continue;
    const ads = Math.max(0, Math.round(numero));
    const existente = leituraExistente(leituras, oferta.id, data, periodo);
    itens.push({
      id: existente ? existente.id : gerarId(),
      ofertaId: oferta.id,
      data,
      periodo,
      ads,
    });
  }
  return itens;
}

/** Preenche o mapa de valores com a última contagem anterior de cada oferta — "Repetir contagens
 * anteriores" (index.html:1446-1454). Oferta sem leitura anterior não entra no mapa devolvido
 * (mantém o campo em branco, não inventa um zero). */
export function repetirContagensAnteriores(ofertas, leituras, data, periodo) {
  const valores = {};
  for (const oferta of ofertas) {
    const anterior = leituraAnterior(leituras, oferta.id, data, periodo);
    if (anterior) valores[oferta.id] = String(anterior.ads);
  }
  return valores;
}
