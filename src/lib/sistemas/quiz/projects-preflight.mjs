// Checagem mínima do vínculo opcional com o Banco. O lookup é injetado para
// manter este núcleo testável sem Drizzle; o Server Action fornece uma query
// por id com `limit(1)`. Nenhum dado da oferta retorna ao navegador.

function invalidResult(code) {
  return { kind: "error", code, receivedAt: null, data: null };
}

export async function validateBancoOfferTrackingLink(input, findOfferTrackingId) {
  const id = input?.bancoOfferTrackingId;
  if (id === null || id === undefined) return null;
  if (!Number.isSafeInteger(id) || id <= 0) return invalidResult("PROVISION_INPUT_INVALID");
  if (typeof findOfferTrackingId !== "function") {
    throw new TypeError("validateBancoOfferTrackingLink: findOfferTrackingId é obrigatório quando há vínculo Banco");
  }
  const exists = await findOfferTrackingId(id);
  return exists ? null : invalidResult("BANCO_OFFER_NOT_FOUND");
}
