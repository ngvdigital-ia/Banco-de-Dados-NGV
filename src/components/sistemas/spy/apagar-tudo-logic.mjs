// "Apagar tudo" (aba Dados e critérios) — porta index.html:1692-1704, COM uma trava que o
// original não tem (handoff pvs-master, 2026-08-16): no original um único `confirm()` do
// navegador já dispara a remoção de TODAS as ofertas + leituras + reset de config. Um clique
// acidental ali destrói o histórico inteiro que sustenta o ranking — e diferente do original
// (senha compartilhada, sem identidade), aqui a ação fica registrada em module_action_log em
// nome de uma pessoa (requireModuleAccess + logModuleAction, ver mutations.ts).
//
// Trava: o botão só habilita depois de digitar a palavra EXATA abaixo — sem trim "generoso"
// (espaço a mais, minúscula, etc. NÃO confirma). Pura de propósito: testável sem montar UI.

export const PALAVRA_CONFIRMACAO_APAGAR_TUDO = "APAGAR";

export function confirmacaoApagarTudoValida(textoDigitado) {
  return textoDigitado === PALAVRA_CONFIRMACAO_APAGAR_TUDO;
}

/**
 * Só chama `executar()` quando a confirmação bate EXATAMENTE. Devolve `{ disparado, motivo }` em
 * vez de lançar — o caller (componente) decide como mostrar a recusa, sem depender de try/catch
 * pra um caminho que não é exceção. Ver teste "não dispara nada sem a palavra" em
 * tests/sistemas-spy-apagar-tudo-logic.test.mjs.
 */
export function executarApagarTudoSeConfirmado(textoDigitado, executar) {
  if (!confirmacaoApagarTudoValida(textoDigitado)) {
    return { disparado: false, motivo: "CONFIRMACAO_INVALIDA" };
  }
  executar();
  return { disparado: true, motivo: null };
}
