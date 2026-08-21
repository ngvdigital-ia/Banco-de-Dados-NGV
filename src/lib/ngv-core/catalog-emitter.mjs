// Emissor do CATÁLOGO de ofertas do Banco para o NGV Core
// (POST /functions/v1/catalog-snapshot-ingest, source_system="banco_ngv").
//
// Por que existe: até 21/08/2026 o Banco só chegava ao Core como CONTAGEM
// (banco_global_daily_projection.offer_tracking_count). As 81 ofertas — que são o
// registro central de oferta da operação — não existiam como linha no Core, então
// nenhuma leitura por oferta conseguia partir delas.
//
// Payload SEM PII: id, nome e datas da oferta. Nada de copy, ticket ou métrica.
//
// Reúsa integralmente a validação de destino do emissor agregado (protocolo, porta,
// credencial e allowlist de host) — só troca o path, porque é outra função no MESMO
// projeto do Core.

import {
  NgvCoreEmitterError,
  resolveNgvCoreConfig,
  validateNgvCoreUrl,
  NGV_CORE_TIMEOUT_MS,
  NGV_CORE_MAX_RESPONSE_BYTES,
} from "./emitter.mjs";

export const NGV_CORE_CATALOG_PATH = "/functions/v1/catalog-snapshot-ingest";
export const NGV_CORE_CATALOG_SOURCE = "banco_ngv";
export const MAX_CATALOG_ITEMS = 5000;

// O Banco não tem coluna de ativo/inativo. O que ele tem é `validation`, e um único
// valor dela significa oferta morta. Mapear é leitura fiel do vocabulário da fonte —
// qualquer outro valor ("EM ANDAMENTO", "NAO", nulo) é oferta ainda em jogo.
export const VALIDACAO_OFERTA_MORTA = "NÃO DEU CERTO";

// Quais linhas de external_mappings viram FILHO de oferta no catálogo. Só a plataforma
// de produto do gateway entra: campanha de UTMify tambem mora em external_mappings, mas
// campanha nao e produto — publicar tudo misturaria dois conceitos dentro de "product".
export const PLATAFORMA_PRODUTO_GATEWAY = "apps_ofertas_product";

/** @returns {never} */
function fail(code) {
  throw new NgvCoreEmitterError(code);
}

function toIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Converte linhas de offer_tracking nos itens do catálogo unificado.
 *
 * O contrato do Core é estrito: o item precisa ter EXATAMENTE estas 10 chaves, ou a
 * edge function devolve 400 sem dizer qual item quebrou. Por isso o objeto é montado
 * literal aqui, e não por spread da linha do banco — uma coluna nova em offer_tracking
 * não pode vazar pro payload e derrubar o lote inteiro.
 *
 * Oferta sem nome utilizável é PULADA em vez de derrubar o snapshot: uma linha ruim
 * não pode custar as outras 80. Quem foi pulado volta em `ignoradas` pra virar log.
 */
export function buildCatalogItems(rows, mappings = []) {
  if (!Array.isArray(rows)) fail("CATALOG_ROWS_INVALID");
  if (!Array.isArray(mappings)) fail("CATALOG_ROWS_INVALID");
  const items = [];
  const ignoradas = [];
  const nomePorOferta = new Map();
  const ativoPorOferta = new Map();
  for (const row of rows) {
    if (row === null || typeof row !== "object") {
      ignoradas.push({ id: null, motivo: "linha nao e objeto" });
      continue;
    }
    const id = row.id;
    if (!Number.isSafeInteger(Number(id)) || String(id).length > 128) {
      ignoradas.push({ id: id ?? null, motivo: "id ausente ou fora do limite" });
      continue;
    }
    const title = String(row.name ?? "").trim();
    if (title.length === 0) {
      ignoradas.push({ id, motivo: "nome vazio" });
      continue;
    }
    const ativo = String(row.validation ?? "").trim() !== VALIDACAO_OFERTA_MORTA;
    nomePorOferta.set(String(id), title.slice(0, 500));
    ativoPorOferta.set(String(id), ativo);
    items.push({
      entity_type: "offer",
      source_id: String(id),
      parent_entity_type: null,
      parent_source_id: null,
      title: title.slice(0, 500),
      description: null,
      sort_order: null,
      is_active: ativo,
      origin_created_at: toIso(row.created_at ?? row.createdAt),
      origin_updated_at: toIso(row.updated_at ?? row.updatedAt),
    });
  }
  // Produto do gateway entra como FILHO da oferta. Sem tabela nova no Core: o catálogo
  // já tem parent_entity_type/parent_source_id, e "este product_id pertence a esta
  // oferta" é exatamente uma relação pai-filho. É o que permite, do lado do Core,
  // somar receita por OFERTA a partir do product_id — o identificador que o gateway
  // emite de verdade, em vez do offer_slug, que é carimbo do ?group= do webhook.
  for (const m of mappings) {
    if (m === null || typeof m !== "object") continue;
    if (String(m.platform ?? "") !== PLATAFORMA_PRODUTO_GATEWAY) continue;
    const paiId = String(m.entity_id ?? "");
    const externo = String(m.external_id ?? "").trim();
    // Ligacao orfa (aponta pra oferta que nao veio) nao pode virar item sem pai: o
    // Core exige o par, e um filho sem pai seria uma oferta fantasma no catalogo.
    if (!nomePorOferta.has(paiId) || externo.length === 0 || externo.length > 128) {
      ignoradas.push({ id: externo || null, motivo: "ligacao sem oferta correspondente" });
      continue;
    }
    items.push({
      entity_type: "product",
      source_id: externo,
      parent_entity_type: "offer",
      parent_source_id: paiId,
      // O par foi derivado de igualdade EXATA de nome, entao o nome da oferta e o nome
      // do produto sao o mesmo texto. Repetir aqui e fiel, nao invencao.
      title: nomePorOferta.get(paiId),
      description: null,
      sort_order: null,
      is_active: ativoPorOferta.get(paiId),
      origin_created_at: toIso(m.created_at),
      origin_updated_at: null,
    });
  }
  if (items.length > MAX_CATALOG_ITEMS) fail("CATALOG_TOO_LARGE");
  return { items, ignoradas };
}

export function buildCatalogPayload(items, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(items)) fail("CATALOG_ROWS_INVALID");
  return {
    schema_version: 1,
    source_system: NGV_CORE_CATALOG_SOURCE,
    generated_at: generatedAt,
    items,
  };
}

/**
 * Destino do catálogo, derivado do MESMO NGV_CORE_URL já configurado.
 *
 * Deliberadamente sem env nova: a URL configurada passa primeiro pelo validador do
 * emissor agregado (https, sem porta/credencial/query, host na allowlist) e só depois
 * o path é trocado. Uma env separada seria um segundo lugar pra apontar errado, e a
 * allowlist de host deixaria de cobrir este emissor.
 */
export function resolveCatalogUrl(options = {}) {
  const config = resolveNgvCoreConfig(options);
  const base = validateNgvCoreUrl(config.url, config.hostAllowlist);
  const url = new URL(base.toString());
  url.pathname = NGV_CORE_CATALOG_PATH;
  return url;
}

async function readLimited(response, limit = NGV_CORE_MAX_RESPONSE_BYTES) {
  if (!response?.body || typeof response.body.getReader !== "function") fail("RESPONSE_BODY_UNREADABLE");
  const reader = response.body.getReader();
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value?.byteLength ?? 0;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        fail("RESPONSE_TOO_LARGE");
      }
    }
  } catch (error) {
    if (error instanceof NgvCoreEmitterError) throw error;
    fail("RESPONSE_BODY_UNREADABLE");
  }
  return total;
}

/**
 * Envia o snapshot do catálogo. Fail-closed na credencial, timeout de 10s,
 * redirect manual, só 2xx é sucesso. Nunca registra credencial nem payload.
 */
export async function emitCatalogSnapshot(rows, mappings = [], options = {}) {
  const config = resolveNgvCoreConfig(options.config);
  if (typeof config.writerKey !== "string" || !config.writerKey) fail("NGV_CORE_WRITER_KEY_MISSING");
  const url = resolveCatalogUrl(options.config);
  const { items, ignoradas } = buildCatalogItems(rows, mappings);
  const payload = buildCatalogPayload(items, options.generatedAt);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-ngv-core-key": config.writerKey,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) fail(`CATALOG_REJECTED_${response.status}`);
    await readLimited(response);
    return {
      kind: "success",
      http_status: response.status,
      enviadas: items.length,
      ofertas: items.filter((i) => i.entity_type === "offer").length,
      produtos: items.filter((i) => i.entity_type === "product").length,
      ignoradas,
      generated_at: payload.generated_at,
    };
  } catch (error) {
    if (error instanceof NgvCoreEmitterError) throw error;
    if (error?.name === "AbortError") fail("NGV_CORE_TIMEOUT");
    fail("NGV_CORE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

export { NGV_CORE_TIMEOUT_MS };
