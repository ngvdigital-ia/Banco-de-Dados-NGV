/**
 * status-labels.ts — Mapas pt-BR de valores técnicos do domínio NGV.
 *
 * Regra: NUNCA expor values brutos (snake_case, ENUM MAIÚSCULO, camelCase)
 * pro usuário. Use `labelOf(map, value)` pra obter o rótulo legível.
 *
 * Fonte de verdade visual: src/app/DESIGN-TOKENS.md
 */

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Retorna o rótulo pt-BR de `value` dentro de `map`.
 * Se o value não existir no mapa, retorna o próprio value como fallback
 * (visível no UI como string crua — serve de sinal pra adicionar ao mapa).
 */
export function labelOf(
  map: Record<string, string>,
  value: string | null | undefined
): string {
  if (value == null || value === "") return "—";
  return map[value] ?? value;
}

// ─── Status de oferta (campo `status` em offer_tracking) ─────────────────────

/**
 * Cobre os valores booleanos/enum usados no campo de status de oferta.
 * Values possíveis: "SIM", "NAO", "EM ANDAMENTO", "NÃO DEU CERTO"
 * e variações snake_case legadas.
 */
export const statusOferta: Record<string, string> = {
  // Canônicos (enum maiúsculo do banco)
  SIM: "Ativo",
  NAO: "Inativo",
  "EM ANDAMENTO": "Em andamento",
  "NÃO DEU CERTO": "Não deu certo",
  // Variações snake_case legadas
  sim: "Ativo",
  nao: "Inativo",
  em_andamento: "Em andamento",
  nao_deu_certo: "Não deu certo",
  // Booleanos textuais
  true: "Ativo",
  false: "Inativo",
};

// ─── Status de pipeline (campo `pipeline_status` / `status` em agentes) ──────

/**
 * Valores possíveis do pipeline de testes/rodagem de agentes.
 */
export const statusPipeline: Record<string, string> = {
  // Canônicos
  escalou: "Escalou",
  nao_escalou: "Não escalou",
  em_teste: "Em teste",
  rodando: "Rodando",
  pausado: "Pausado",
  // Variações UPPER
  ESCALOU: "Escalou",
  NAO_ESCALOU: "Não escalou",
  EM_TESTE: "Em teste",
  RODANDO: "Rodando",
  PAUSADO: "Pausado",
};

// ─── Status de aprovação de agente (agent_approvals) ─────────────────────────

export const statusAprovacao: Record<string, string> = {
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  pendente: "Pendente",
  em_ajustes: "Em ajustes",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  PENDENTE: "Pendente",
  EM_AJUSTES: "Em ajustes",
};

// ─── Tipo de oferta (campo `type` / `offer_type`) ────────────────────────────

export const tipoOferta: Record<string, string> = {
  vsl: "VSL",
  tsl: "TSL",
  VSL: "VSL",
  TSL: "TSL",
  advertorial: "Advertorial",
  ADVERTORIAL: "Advertorial",
  lp: "Landing Page",
  LP: "Landing Page",
};

// ─── Idioma da oferta ─────────────────────────────────────────────────────────

export const idiomaOferta: Record<string, string> = {
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
  PT: "Português",
  EN: "Inglês",
  ES: "Espanhol",
  "pt-BR": "Português (BR)",
  "en-US": "Inglês (EUA)",
};

// ─── Status de campanha Meta Ads ─────────────────────────────────────────────

export const statusCampanha: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  DELETED: "Excluída",
  ARCHIVED: "Arquivada",
  active: "Ativa",
  paused: "Pausada",
  deleted: "Excluída",
  archived: "Arquivada",
};

// ─── Status de projeto ────────────────────────────────────────────────────────

export const statusProjeto: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
  ARQUIVADO: "Arquivado",
};

// ─── Papel do membro (team / clerk) ──────────────────────────────────────────

export const papelMembro: Record<string, string> = {
  admin: "Administrador",
  member: "Membro",
  viewer: "Visualizador",
  guest: "Convidado",
  org: "Organização",
  basic_member: "Membro",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
};
