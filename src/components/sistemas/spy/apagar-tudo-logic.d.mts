export declare const PALAVRA_CONFIRMACAO_APAGAR_TUDO: "APAGAR";

export declare function confirmacaoApagarTudoValida(textoDigitado: string): boolean;

export interface ResultadoApagarTudo {
  disparado: boolean;
  motivo: "CONFIRMACAO_INVALIDA" | null;
}

export declare function executarApagarTudoSeConfirmado(
  textoDigitado: string,
  executar: () => void,
): ResultadoApagarTudo;
