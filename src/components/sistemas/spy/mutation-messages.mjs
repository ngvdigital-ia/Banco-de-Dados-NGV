// Tradução de `SpyMutationResult` (kind "not_configured"/"error") pra mensagem útil ao operador —
// usada pelos 3 painéis de escrita (leitura-do-dia, ofertas, dados-criterios). Mesma convenção de
// função pura testável dos outros núcleos deste diretório.
//
// Exigência do handoff (pvs-master, 2026-08-16): "senha do Spy recusada" é um erro DIFERENTE de "o
// Spy recusou a operação" — o operador precisa saber se o problema é a credencial configurada no
// ambiente (SPY_DASHBOARD_PASSWORD, ninguém que ele mexe) ou o dado que ele mandou (algo que ele
// PODE corrigir). Os códigos vêm de mutations-client.mjs: `LOGIN_*` é sempre a etapa de login
// (mesmo endpoint, não importa a operação); `${OP_PREFIX}_*` é a etapa da operação em si.

const MENSAGENS_LOGIN = {
  LOGIN_UNAUTHORIZED: "O Spy recusou a senha configurada neste ambiente (SPY_DASHBOARD_PASSWORD) — login falhou.",
  LOGIN_RATE_LIMITED: "O Spy limitou as tentativas de login (rate limit) — aguarde antes de tentar de novo.",
  LOGIN_COOKIE_MISSING: "O Spy aceitou a senha mas não devolveu a sessão esperada.",
  LOGIN_UNEXPECTED_REDIRECT: "O Spy respondeu ao login com um redirecionamento, que este adapter nunca segue.",
  LOGIN_UPSTREAM_ERROR: "O Spy teve um erro interno durante o login.",
  LOGIN_REQUEST_INVALID: "O Spy recusou a requisição de login.",
};

const SUFIXOS_OPERACAO = [
  ["_UNEXPECTED_REDIRECT", "O Spy respondeu esta operação com um redirecionamento, que nunca é seguido."],
  ["_UNAUTHORIZED", "O Spy recusou esta operação por permissão — a sessão logou, mas não tem acesso a isto."],
  ["_RATE_LIMITED", "O Spy limitou as tentativas desta operação — aguarde antes de tentar de novo."],
  ["_NOT_FOUND", "O Spy não encontrou o registro desta operação — pode já ter sido removido por outra pessoa."],
  ["_CONFLICT", "O Spy recusou por conflito com o estado atual do dado."],
  ["_UPSTREAM_ERROR", "O Spy teve um erro interno ao processar esta operação."],
  ["_RESPONSE_JSON_INVALID", "O Spy respondeu com um corpo que não é JSON válido."],
  ["_RESPONSE_SCHEMA_INVALID", "O Spy respondeu num formato que este painel não reconhece."],
  ["_VALIDATION_INVALID", "Os dados não passaram na validação antes de sair daqui — confira os campos."],
  // REQUEST_INVALID por último: sufixo mais genérico, não pode capturar os mais específicos acima
  // (ex.: "..._RESPONSE_JSON_INVALID" também termina em algo parecido, mas já foi tratado antes).
  ["_REQUEST_INVALID", "O Spy recusou os dados enviados nesta operação."],
];

const MENSAGENS_GERAIS = {
  TIMEOUT: "O Spy demorou mais que o limite seguro para responder.",
  NETWORK_ERROR: "Não foi possível alcançar o Spy agora.",
  FETCH_UNAVAILABLE: "Este ambiente não tem `fetch` disponível para falar com o Spy.",
  BASE_URL_INVALID: "O endereço configurado do Spy é inválido neste ambiente.",
  RESPONSE_TOO_LARGE: "A resposta do Spy excedeu o tamanho máximo aceito.",
  RESPONSE_BODY_UNREADABLE: "Não foi possível ler o corpo da resposta do Spy.",
};

/**
 * @param {{ kind: "not_configured", reason?: string } | { kind: "error", code?: string }} result
 * @returns {{ titulo: string, detalhe: string, isLoginError: boolean, codigo: string }}
 */
export function descreverErroMutacaoSpy(result) {
  if (result.kind === "not_configured") {
    const codigo = result.reason ?? "NOT_CONFIGURED";
    return {
      titulo: "Spy não configurado",
      detalhe:
        codigo === "MISSING_CREDENTIALS"
          ? "A credencial do Spy Analytics (SPY_DASHBOARD_PASSWORD) não está configurada neste ambiente."
          : "Este ambiente ainda não tem o módulo do Spy Analytics configurado para escrita.",
      isLoginError: false,
      codigo,
    };
  }

  const codigo = result.code ?? "UNKNOWN";

  if (codigo in MENSAGENS_LOGIN) {
    return { titulo: "Login do Spy recusado", detalhe: MENSAGENS_LOGIN[codigo], isLoginError: true, codigo };
  }
  if (codigo.startsWith("LOGIN_")) {
    return {
      titulo: "Login do Spy recusado",
      detalhe: `O Spy recusou o login (${codigo}).`,
      isLoginError: true,
      codigo,
    };
  }

  if (codigo in MENSAGENS_GERAIS) {
    return { titulo: "Não foi possível falar com o Spy", detalhe: MENSAGENS_GERAIS[codigo], isLoginError: false, codigo };
  }

  const sufixo = SUFIXOS_OPERACAO.find(([suf]) => codigo.endsWith(suf));
  if (sufixo) {
    return { titulo: "O Spy recusou a operação", detalhe: sufixo[1], isLoginError: false, codigo };
  }

  return {
    titulo: "O Spy recusou a operação",
    detalhe: `Diagnóstico seguro: ${codigo}.`,
    isLoginError: false,
    codigo,
  };
}
