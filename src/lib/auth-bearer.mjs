// Guarda de `Authorization: Bearer <segredo>` — a REGRA, num lugar só.
//
// Por que existe: o padrão antigo espalhado por 9 rotas era
//
//     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401
//
// e ele falha ABERTO. Sem a variável configurada, a interpolação produz a string literal
// "Bearer undefined" — e quem mandar exatamente esse header entra. É uma senha adivinhável,
// sem nenhum erro sinalizando o problema: o pior default possível.
//
// A regra aqui recusa segredo ausente/vazio ANTES de comparar. Sem segredo configurado,
// NINGUÉM entra (nem quem manda "Bearer undefined").
//
// Fora de escopo, de propósito (dívida conhecida, anotada e não paga agora):
// a comparação NÃO é timing-safe. Continua sendo `===`, igual ao que as 9 rotas já faziam.
// Trocar o esquema de comparação em 9 rotas de produção junto com esta mudança é risco
// desproporcional — o vetor consertado aqui (segredo ausente = senha pública) é ordens de
// grandeza mais provável que um ataque de timing contra Vercel Edge. Existe um exemplo
// timing-safe no repo (`secureEqual` em src/app/api/cron/sync-ngv-core/route.ts) pra quando
// alguém decidir migrar — de propósito, uma rota de cada vez.
//
// Sem Next e sem Drizzle aqui: dá pra provar os 4 caminhos de verdade em
// tests/auth-bearer.test.mjs (ausente → 401 · vazio → 401 · "Bearer undefined" → 401 · certo → passa).

/**
 * Compara o header `Authorization` inteiro contra `Bearer <secret>`.
 *
 * Fail-closed: segredo que não é string, string vazia ou só espaço em branco
 * derruba TODA requisição — inclusive a que manda o literal "Bearer undefined".
 *
 * @param {string | null | undefined} authHeader valor cru do header Authorization
 * @param {string | null | undefined} secret segredo esperado (process.env.<VAR>)
 * @returns {boolean} true só quando há segredo configurado E o header casa exatamente
 */
export function isAuthorizedBearer(authHeader, secret) {
  if (typeof secret !== "string" || secret.trim() === "") return false;
  return authHeader === `Bearer ${secret}`;
}
