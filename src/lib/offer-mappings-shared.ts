// Constantes do mapeamento oferta↔externo — CLIENT-SAFE (sem imports de db/server).
// Mesmo padrão de site-urls-types.ts: client components importam DAQUI; o módulo
// server (offer-mappings.ts) re-exporta. Importar offer-mappings.ts num client
// bundla o driver neon() e derruba a página ("No database connection string").

export const PLATFORM_UTMIFY_CAMPAIGN = "utmify_campaign";
export const PLATFORM_UTMIFY_PRODUCT = "utmify_product";
