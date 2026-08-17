// Lógica pura da rota GET /api/admin/offers/lookup — leitura do registro completo de UMA
// oferta por id OU por nome, pro mesmo consumidor que já escreve em POST /api/admin/offer-domains
// (agente externo autenticado com Bearer <CRON_SECRET>).
//
// Por que fora da route: o que importa aqui é a RESOLUÇÃO, e ela precisa ser idêntica à do
// POST /api/admin/offer-domains — id exato ganha; nome usa ILIKE %nome%; nome ambíguo NUNCA é
// resolvido por conta própria (409 com as candidatas). Se leitura e escrita discordarem sobre
// "que oferta é essa", o agente lê uma e grava em outra. Sem Drizzle/Next aqui, então dá pra
// testar os 5 caminhos de verdade em tests/admin-offer-lookup.test.mjs.
//
// Projeção = ALLOWLIST explícita. Fica de fora, de propósito:
//   - quem é a PESSOA (copyVsl, copyAds, editorVsl, editorAds, adsCopyByPerson,
//     adsEditedByPerson, editorStatus) — o consumidor é máquina e quer link/status, não equipe;
//   - observations (texto livre digitado por humano — é onde segredo/PII vaza por acidente).
// Coluna nova em offer_tracking NÃO entra no retorno sozinha: tem que ser adicionada aqui.

export const OFFER_LOOKUP_CODES = Object.freeze({
  UNAUTHORIZED: "UNAUTHORIZED",
  MISSING_IDENTIFIER: "MISSING_IDENTIFIER",
  INVALID_ID: "INVALID_ID",
  INVALID_NAME: "INVALID_NAME",
  OFFER_NOT_FOUND: "OFFER_NOT_FOUND",
  OFFER_NAME_AMBIGUOUS: "OFFER_NAME_AMBIGUOUS",
});

// Mesmo teto de candidatas do POST /api/admin/offer-domains (matches.slice(0, 10)).
export const MAX_CANDIDATES = 10;
// Mesmo teto do offerName do POST /api/admin/offer-domains.
export const MAX_NAME_LENGTH = 200;

const MAX_INT4 = 2147483647; // offer_tracking.id é serial (int4)

const LIST_HINT =
  "GET /api/admin/offers (mesmo Bearer) lista id + nome de todas as ofertas — use o id de lá.";

// Compara o header inteiro, igual às rotas admin/cron já existentes.
// Diferença deliberada: sem CRON_SECRET configurado NINGUÉM entra (o `Bearer undefined`
// interpolado seria uma senha adivinhável).
export function isAuthorizedBearer(authHeader, secret) {
  if (typeof secret !== "string" || secret.trim() === "") return false;
  return authHeader === `Bearer ${secret}`;
}

function asTrimmed(value) {
  if (value == null) return "";
  return String(value).trim();
}

// ?id= tem precedência sobre ?name= — mesma precedência de offerId sobre offerName no POST.
export function parseIdentifier(params) {
  const rawId = asTrimmed(params?.id);
  const rawName = asTrimmed(params?.name);

  if (rawId === "" && rawName === "") {
    return {
      kind: "error",
      status: 400,
      body: {
        error: "Informe ?id=<offerId> ou ?name=<trecho do nome>",
        code: OFFER_LOOKUP_CODES.MISSING_IDENTIFIER,
        hint: LIST_HINT,
      },
    };
  }

  if (rawId !== "") {
    const isDigits = /^\d+$/.test(rawId);
    const parsed = isDigits ? Number(rawId) : Number.NaN;
    if (!isDigits || parsed <= 0 || parsed > MAX_INT4) {
      return {
        kind: "error",
        status: 400,
        body: {
          error: `id inválido: "${rawId}" não é um inteiro positivo`,
          code: OFFER_LOOKUP_CODES.INVALID_ID,
          hint: LIST_HINT,
        },
      };
    }
    return { kind: "id", id: parsed };
  }

  if (rawName.length > MAX_NAME_LENGTH) {
    return {
      kind: "error",
      status: 400,
      body: {
        error: `name excede ${MAX_NAME_LENGTH} caracteres`,
        code: OFFER_LOOKUP_CODES.INVALID_NAME,
        hint: LIST_HINT,
      },
    };
  }

  return { kind: "name", name: rawName };
}

function toIso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function siteUrlsOf(row) {
  const urls = row?.siteUrls;
  if (!urls || typeof urls !== "object" || Array.isArray(urls)) return null;
  return urls;
}

// Espelho de totalLinks() em src/lib/site-urls-types.ts:121 — a fonte da verdade.
// Duplicado aqui de propósito: este módulo é .mjs pra ser testável sem Next/Drizzle, e
// não consegue importar o .ts. Se totalLinks mudar, mudar aqui também.
//
// `domain` NÃO conta como link (é o host raiz, não uma página) — mesma regra do filtro
// ?has_site_urls= do GET /api/admin/offers, que também usa totalLinks(urls) > 0.
function countLinks(urls) {
  if (!urls) return 0;
  let n = 0;
  if (urls.vsl) n++;
  if (urls.quiz) n++;
  if (Array.isArray(urls.whites)) n += urls.whites.length;
  if (Array.isArray(urls.custom)) n += urls.custom.length;
  return n;
}

// Registro completo do ponto de vista de quem pergunta "qual é o link dessa oferta?".
export function projectOffer(row) {
  const siteUrls = siteUrlsOf(row);
  return {
    id: row.id,
    name: row.name,
    language: row.language ?? null,
    ticket: row.ticket ?? null,
    gender: row.gender ?? null,
    adFormat: row.adFormat ?? null,
    status: {
      copyVsl: row.copyVslStatus ?? null,
      copyCriativos: row.copyCriativosStatus ?? null,
      vslInVturb: row.vslInVturb ?? null,
      campaignsActive: row.campaignsActive ?? null,
      validation: row.validation ?? null,
      preScale: row.preScale ?? null,
      scale: row.scale ?? null,
      productCreated: row.productCreated ?? null,
      productApproved: row.productApproved ?? null,
      siteCreated: row.siteCreated ?? null,
    },
    ads: {
      editedCount: row.adsEditedCount ?? 0,
      rejectedCount: row.adsRejectedCount ?? 0,
    },
    // hasSiteUrls responde "essa oferta já tem PÁGINA no ar?" — que é a pergunta que o
    // consumidor faz antes de decidir se cria uma. Por isso é linkCount > 0, e NÃO
    // "a coluna jsonb é não-nula": tirar o último link pela UI ou pelo webhook grava `{}`
    // (normalizeSiteUrls devolve objeto vazio), então `siteUrls != null` diria "sim" pra
    // oferta com zero páginas e o agente pularia a criação.
    // Divergência deliberada do campo homônimo do GET /api/admin/offers, que devolve
    // `urls != null` — lá o linkCount ao lado desmente; aqui o resumo tem que ser honesto
    // sozinho. Bate com o filtro ?has_site_urls= daquela rota, que já usa totalLinks > 0.
    hasSiteUrls: countLinks(siteUrls) > 0,
    linkCount: countLinks(siteUrls),
    domain: siteUrls?.domain ?? null,
    siteUrls,
    // siteUrl é o espelho legado de siteUrls.vsl (one-way) — vem junto só pra quem ainda lê o campo antigo.
    siteUrl: row.siteUrl ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

// O suficiente pra um humano/agente DESEMPATAR sem que a rota escolha por ele.
export function projectCandidate(row) {
  const siteUrls = siteUrlsOf(row);
  return {
    id: row.id,
    name: row.name,
    language: row.language ?? null,
    validation: row.validation ?? null,
    domain: siteUrls?.domain ?? null,
    createdAt: toIso(row.createdAt),
  };
}

export async function lookupOffer({ authHeader, cronSecret, params, findById, findByName }) {
  if (!isAuthorizedBearer(authHeader, cronSecret)) {
    return { status: 401, body: { error: "Unauthorized", code: OFFER_LOOKUP_CODES.UNAUTHORIZED } };
  }

  const identifier = parseIdentifier(params);
  if (identifier.kind === "error") {
    return { status: identifier.status, body: identifier.body };
  }

  if (identifier.kind === "id") {
    const row = await findById(identifier.id);
    if (!row) {
      return {
        status: 404,
        body: {
          error: `Oferta #${identifier.id} não existe`,
          code: OFFER_LOOKUP_CODES.OFFER_NOT_FOUND,
          hint: `${LIST_HINT} Ou busque por nome com ?name=<trecho>.`,
        },
      };
    }
    return { status: 200, body: { success: true, matchedBy: "id", offer: projectOffer(row) } };
  }

  const matches = (await findByName(identifier.name)) ?? [];

  if (matches.length === 0) {
    return {
      status: 404,
      body: {
        error: `Nenhuma oferta com nome contendo "${identifier.name}"`,
        code: OFFER_LOOKUP_CODES.OFFER_NOT_FOUND,
        hint: `A busca por nome é "contém", não exata — tente um trecho menor. ${LIST_HINT}`,
      },
    };
  }

  if (matches.length > 1) {
    return {
      status: 409,
      body: {
        error: `${matches.length} ofertas casam com "${identifier.name}". Escolha uma e repita com ?id=<id>.`,
        code: OFFER_LOOKUP_CODES.OFFER_NAME_AMBIGUOUS,
        totalMatches: matches.length,
        candidates: matches.slice(0, MAX_CANDIDATES).map(projectCandidate),
        hint:
          "Nomes colidem nesta base e esta rota NÃO escolhe por você — POST /api/admin/offer-domains rejeita nome ambíguo do mesmo jeito (409).",
      },
    };
  }

  return { status: 200, body: { success: true, matchedBy: "name", offer: projectOffer(matches[0]) } };
}
