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
 * @param {{ status: string }[]} results
 * @returns {boolean} true se pelo menos um item da passada teve status "ok"
 */
export function shouldReplaceSnapshots(results) {
  return results.some((r) => r.status === "ok");
}
