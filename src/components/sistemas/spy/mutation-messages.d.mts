export interface DescricaoErroMutacaoSpy {
  titulo: string;
  detalhe: string;
  isLoginError: boolean;
  codigo: string;
}

export declare function descreverErroMutacaoSpy(
  result: { kind: "not_configured"; reason?: string } | { kind: "error"; code?: string },
): DescricaoErroMutacaoSpy;
