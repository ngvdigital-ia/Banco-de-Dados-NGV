/**
 * Resolve o ID da oferta para um nome de campanha.
 * Assinatura: (campaignName: string | null | undefined, dbMap: Record<string, number>)
 * Retorna: { id: number | null; resolution: "db" | "unresolved" }
 * Função pura: sem banco, sem I/O, sem Date, sem console.
 */
export function resolveOfferTrackingId(campaignName, dbMap) {
  if (!campaignName) {
    return { id: null, resolution: "unresolved" };
  }
  const key = campaignName.toLowerCase().trim();
  if (!key) {
    return { id: null, resolution: "unresolved" };
  }
  const id = dbMap[key];
  if (id !== undefined) {
    return { id, resolution: "db" };
  }
  return { id: null, resolution: "unresolved" };
}
