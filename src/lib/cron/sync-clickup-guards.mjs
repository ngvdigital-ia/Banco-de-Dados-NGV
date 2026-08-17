/**
 * Decisão pura de proteção do replace atômico (delete + insert) do sync-clickup.
 *
 * Um replace (delete de tudo + insert do que veio da API) só é seguro quando pelo
 * menos uma lista da passada respondeu com sucesso. Se todas as listas falharem
 * (chave revogada, ClickUp fora do ar), o delete NUNCA deve rodar — senão o cron
 * apaga dado bom e não tem nada de novo pra repor.
 *
 * Extraída como função pura (sem I/O) para ser testável sem chamar a rota de verdade.
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
