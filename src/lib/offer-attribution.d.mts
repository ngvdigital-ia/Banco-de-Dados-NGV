/**
 * Resolve o `offer_tracking.id` a partir do nome da campanha, contra um mapa
 * já carregado do banco (`getDbCampaignOfferIds`).
 *
 * A chave é normalizada com `.toLowerCase().trim()` dos dois lados. Só casa
 * igualdade exata depois disso — substring e prefixo NÃO casam, de propósito:
 * atribuir a venda à oferta errada é pior do que não atribuir.
 *
 * `resolution` existe para o não-atribuído ficar VISÍVEL em vez de silencioso.
 */
export declare function resolveOfferTrackingId(
  campaignName: string | null | undefined,
  dbMap: Record<string, number>,
): { id: number | null; resolution: "db" | "unresolved" };
