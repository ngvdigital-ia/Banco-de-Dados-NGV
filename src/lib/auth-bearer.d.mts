/**
 * Guarda de `Authorization: Bearer <segredo>`, fail-closed.
 *
 * Segredo ausente/vazio → `false` para qualquer header (inclusive o literal
 * "Bearer undefined", que o padrão antigo por interpolação deixava passar).
 *
 * A comparação NÃO é timing-safe — dívida conhecida, documentada em auth-bearer.mjs.
 */
export declare function isAuthorizedBearer(
  authHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean;
