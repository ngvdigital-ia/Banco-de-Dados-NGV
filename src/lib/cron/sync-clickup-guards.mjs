/**
 * Decisões puras (sem I/O) do sync-clickup — testáveis sem chamar a rota de verdade.
 *
 * shouldReplaceSnapshots: "pelo menos uma lista respondeu com sucesso". Era a guarda do
 * replace; hoje a rota a usa só pro campo `success` da resposta — quem libera o delete é
 * isCompleteSync.
 *
 * isCompleteSync: guarda ESTRITA da troca (delete + insert). Exige que TODAS as listas
 * responderam "ok" E que pelo menos uma task foi encontrada. Passada parcial (alguma
 * lista errou) ou vazia (nenhuma task) retorna false — nunca apagar nada com um
 * conjunto de entrada incompleto (senão o delete apagaria linhas que ainda existem no
 * ClickUp mas não vieram nesta passada).
 */

/**
 * Fail-closed em entrada inesperada: uma guarda de "posso apagar?" nunca pode lançar —
 * lançar derruba a rota no meio (pior que apagar? não — mas ainda errado: a guarda existe
 * pra decidir com calma, não pra virar um crash em cron de produção). `results` que não for
 * array (null, undefined, objeto solto, string) não tem lista nenhuma comprovadamente "ok",
 * então a resposta é `false` sem tentar iterar.
 *
 * Item nulo/estranho DENTRO do array (ex.: `[{status:'ok'}, null]`) não invalida os outros
 * itens: `r?.status === "ok"` trata esse item como "não é ok" (mesmo tratamento que um item
 * com status "error" já recebia) e o `.some` segue procurando um sucesso real nos demais.
 * Escolha: `true` quando existir pelo menos 1 item genuinamente "ok" no array, mesmo que
 * outros itens estejam malformados — malformação de UM item da passada não é evidência de
 * falha sistêmica das OUTRAS listas que responderam certo.
 *
 * @param {{ status: string }[]} results
 * @returns {boolean} true se pelo menos um item da passada teve status "ok"; false pra
 *   qualquer entrada que não seja um array (nunca lança)
 */
export function shouldReplaceSnapshots(results) {
  if (!Array.isArray(results)) return false;
  return results.some((r) => r?.status === "ok");
}

/**
 * Guarda estrita da troca: a passada só pode substituir o conjunto quando
 * TODAS as listas responderam "ok" e há pelo menos 1 task encontrada. Fail-closed
 * em entrada inesperada (nunca lança): não-array, array vazio, item malformado ou
 * lista com erro -> false.
 *
 * @param {{ status: string, tasksFound?: number }[]} results
 * @returns {boolean} true só quando a passada é COMPLETA e NÃO-VAZIA
 */
export function isCompleteSync(results) {
  if (!Array.isArray(results) || results.length === 0) return false;
  if (!results.every((r) => r?.status === "ok")) return false;
  return results.some((r) => (r?.tasksFound ?? 0) > 0);
}
