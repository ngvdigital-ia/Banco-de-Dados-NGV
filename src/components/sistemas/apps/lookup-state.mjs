// Núcleo puro da tela de lookup de Apps (/sistemas/apps-ofertas) — a tradução de
// "o que a rota respondeu" para "o que o operador lê na tela", sem React e sem
// runtime do Next, testável via `node --test`. Mesma convenção dos núcleos de
// src/components/sistemas/spy/ (avaliacao.mjs, mutation-messages.mjs).
//
// Por que isso é um módulo e não `if` espalhado no JSX: os estados desta tela são o
// produto, não decoração. "Não encontrei ninguém com esse e-mail" e "deu erro" são
// respostas DIFERENTES, e cair num vazio mudo em qualquer um dos dois faz o operador
// concluir que a pessoa não comprou — que é a mentira mais cara desta operação.

/** Fases da busca. `done` carrega o par (status, body) que a regra da rota devolveu. */
export const APPS_LOOKUP_ESTADOS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  FOUND: "found",
  EMPTY: "empty",
  INVALID: "invalid",
  UNAUTHORIZED: "unauthorized",
  DISABLED: "disabled",
  ERROR: "error",
});

const NADA_ENCONTRADO =
  "Não encontrei ninguém com esse e-mail. Isso NÃO é erro — é uma resposta válida, e é diferente " +
  "de falha na consulta. Confira se o e-mail é o mesmo da compra (o do pagamento costuma divergir " +
  "do e-mail de contato) e leia o aviso do espelho acima antes de concluir que a pessoa não tem acesso.";

function listaVazia(body) {
  const vazio = (chave) => !Array.isArray(body?.[chave]) || body[chave].length === 0;
  return vazio("access") && vazio("purchases") && vazio("products");
}

/**
 * @param {{ fase?: string, status?: number, body?: Record<string, unknown>, falhou?: boolean }} entrada
 * @returns {{ estado: string, titulo: string, detalhe: string, tom: "neutro"|"info"|"aviso"|"erro" }}
 */
export function descreverLookup(entrada = {}) {
  const { fase, status, body, falhou } = entrada;

  if (fase === "loading") {
    return {
      estado: APPS_LOOKUP_ESTADOS.LOADING,
      titulo: "Consultando o Core…",
      detalhe: "Buscando acessos, compras e produtos desse e-mail no espelho do NGV Core.",
      tom: "info",
    };
  }

  if (fase !== "done") {
    return {
      estado: APPS_LOOKUP_ESTADOS.IDLE,
      titulo: "Nenhuma busca ainda",
      detalhe: "Digite o e-mail do cliente e clique em Consultar para ver a quais ofertas ele tem acesso.",
      tom: "neutro",
    };
  }

  // A rede caiu / a resposta nem chegou: nunca some em silêncio.
  if (falhou || typeof status !== "number") {
    return {
      estado: APPS_LOOKUP_ESTADOS.ERROR,
      titulo: "A consulta não chegou a ser respondida",
      detalhe:
        "A requisição falhou antes de o painel receber resposta (rede, sessão expirada ou deploy em andamento). " +
        "Recarregue a página e tente de novo; se repetir, avise o time de dados antes de responder ao cliente.",
      tom: "erro",
    };
  }

  if (status === 400) {
    return {
      estado: APPS_LOOKUP_ESTADOS.INVALID,
      titulo: "E-mail inválido",
      // A mensagem da regra é a que manda — o painel não inventa texto por cima dela.
      detalhe: `${typeof body?.error === "string" && body.error ? body.error : "E-mail inválido"}. Confira se não faltou o @ ou o domínio, e tente de novo.`,
      tom: "aviso",
    };
  }

  if (status === 401 || status === 403) {
    return {
      estado: APPS_LOOKUP_ESTADOS.UNAUTHORIZED,
      titulo: "Sessão ou credencial recusada",
      detalhe:
        "O painel não conseguiu se autenticar para esta consulta. Saia e entre de novo; se continuar, " +
        "a credencial do servidor (CRON_SECRET) precisa ser conferida por quem cuida do deploy — não é " +
        "algo que você resolve nesta tela.",
      tom: "erro",
    };
  }

  if (status === 503) {
    return {
      estado: APPS_LOOKUP_ESTADOS.DISABLED,
      titulo: "Módulo desligado por configuração",
      detalhe:
        "Este ambiente ainda não tem o lookup configurado (falta a URL da função apps-lookup-read no Core " +
        "ou a credencial do Banco). Enquanto isso, consulte o acesso direto no painel do Apps. Nenhum dado " +
        "foi consultado.",
      tom: "aviso",
    };
  }

  if (status !== 200) {
    return {
      estado: APPS_LOOKUP_ESTADOS.ERROR,
      titulo: "O Core não respondeu esta consulta",
      detalhe:
        "A consulta chegou, mas o NGV Core devolveu erro. Tente de novo em alguns minutos; se repetir, " +
        "avise o time de dados e use o painel do Apps como fonte enquanto isso. NÃO conclua que a pessoa " +
        "está sem acesso a partir desta tela.",
      tom: "erro",
    };
  }

  if (listaVazia(body)) {
    return {
      estado: APPS_LOOKUP_ESTADOS.EMPTY,
      titulo: "Nenhum acesso encontrado para esse e-mail",
      detalhe: NADA_ENCONTRADO,
      tom: "aviso",
    };
  }

  return {
    estado: APPS_LOOKUP_ESTADOS.FOUND,
    titulo: "Acesso encontrado",
    detalhe: "Leitura do espelho do NGV Core. A fonte da verdade continua sendo o painel do Apps.",
    tom: "info",
  };
}

// ── Aviso de completude do espelho ───────────────────────────────────────────
//
// A rota lê o espelho `ngv_apps` do Core, que é alimentado por backfill — ele pode
// estar ATRÁS da fonte. Uma tela que responde "essa pessoa não tem acesso" quando o
// espelho é que está incompleto mente pro operador.
//
// Os dois números existem no resumo operacional do Core e são lidos de verdade:
//   projetados = rolling_migration.apps_ofertas_active_accesses (o que já está no espelho)
//   naFonte    = sources.apps_ofertas.access_active             (o que o Apps reporta ter)
// A idade vem de freshness.by_source.apps_ofertas.age_hours.
// Sem esses campos, cai no aviso fixo — nunca em silêncio.

const AVISO_SEM_MEDIDA =
  "Não consegui ler agora quanto do espelho já foi preenchido nem a idade dele. Trate esta tela como " +
  "possivelmente ATRASADA: a fonte da verdade é o painel do Apps. O backfill que fecha a diferença roda " +
  "de madrugada, às 06:15.";

function inteiro(valor) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * @param {unknown} summary resultado de fetchNgvCoreOperationalSummary()
 * @returns {{ medido: boolean, coerente: boolean, completo: boolean, projetados: number|null,
 *            naFonte: number|null, faltando: number|null, idadeHoras: number|null, titulo: string,
 *            detalhe: string, tom: "aviso"|"info" }}
 *
 * `medido`   houve os dois números para comparar.
 * `coerente` os dois números fazem sentido juntos (espelho <= fonte). `false` SÓ quando medimos
 *            e eles se contradizem — não-medido não é incoerente, é desconhecido.
 * `completo` só pode ser `true` quando `medido && coerente`.
 */
export function descreverEspelhoApps(summary) {
  const resumo = summary && typeof summary === "object" ? summary : null;
  const projetados = inteiro(resumo?.rolling_migration?.apps_ofertas_active_accesses);
  const naFonte = inteiro(resumo?.sources?.apps_ofertas?.access_active);
  const idadeHoras = inteiro(resumo?.freshness?.by_source?.apps_ofertas?.age_hours);

  if (resumo?.kind !== "success" || projetados === null || naFonte === null) {
    return {
      medido: false,
      coerente: true,
      completo: false,
      projetados,
      naFonte,
      faltando: null,
      idadeHoras,
      titulo: "O espelho pode estar atrasado",
      detalhe: AVISO_SEM_MEDIDA,
      tom: "aviso",
    };
  }

  const idade = idadeHoras === null ? "idade desconhecida" : `medido há ${idadeHoras} h`;

  // Espelho MAIOR que a fonte não existe no mundo real: é sinal de que uma das duas medidas
  // está velha. Sem esta guarda, o Math.max() abaixo zera a diferença e a tela declara
  // "completo" com tranquilidade — foi exatamente o que aconteceu com 110 espelhados contra
  // 106 na fonte (a projeção apps_offers_daily congelou e ficou para trás do espelho vivo).
  // Declarar completude a partir de números que se contradizem é a mentira mais cara desta
  // tela, então aqui ela se recusa a afirmar qualquer das duas coisas.
  if (projetados > naFonte) {
    return {
      medido: true,
      coerente: false,
      completo: false,
      projetados,
      naFonte,
      faltando: null,
      idadeHoras,
      titulo: `Números do espelho não batem: ${projetados} espelhados contra ${naFonte} na fonte (${idade})`,
      detalhe:
        `O espelho tem MAIS acessos (${projetados}) do que a fonte diz existir (${naFonte}), e isso não ` +
        "acontece de verdade — uma das duas medidas está atrasada. Enquanto os números não baterem, NÃO dá " +
        "pra afirmar se o espelho está completo: \"não encontrei\" nesta tela PODE ser espelho incompleto, e " +
        "não ausência de acesso. Confirme no painel do Apps antes de responder ao cliente, e avise o time de " +
        "dados que as duas contagens do Core divergiram.",
      tom: "aviso",
    };
  }

  const faltando = Math.max(0, naFonte - projetados);

  if (faltando === 0) {
    return {
      medido: true,
      coerente: true,
      completo: true,
      projetados,
      naFonte,
      faltando: 0,
      idadeHoras,
      titulo: `Espelho completo: ${projetados} de ${naFonte} acessos (${idade})`,
      detalhe:
        "O espelho do Core está com todos os acessos que o Apps reporta. Ainda assim, o que aparece aqui " +
        "é uma cópia: para agir sobre o acesso do cliente, a fonte da verdade é o painel do Apps.",
      tom: "info",
    };
  }

  return {
    medido: true,
    coerente: true,
    completo: false,
    projetados,
    naFonte,
    faltando,
    idadeHoras,
    titulo: `Espelho incompleto: ${projetados} de ${naFonte} acessos (${idade})`,
    detalhe:
      `Faltam ${faltando} acesso(s) para o espelho igualar o que o Apps reporta — o backfill que fecha essa ` +
      "diferença roda de madrugada, às 06:15. Enquanto isso, \"não encontrei\" nesta tela PODE ser espelho " +
      "incompleto, e não ausência de acesso: confirme no painel do Apps antes de responder ao cliente.",
    tom: "aviso",
  };
}

// ── Rótulos e destaque por estado do produto ─────────────────────────────────

const PRODUTO = {
  comprado: { rotulo: "Comprado", variante: "success" },
  liberado_manual: { rotulo: "Liberado manual", variante: "info" },
  bloqueado: { rotulo: "Bloqueado", variante: "neutral" },
};

/** @returns {{ rotulo: string, variante: "success"|"info"|"neutral"|"warning" }} */
export function descreverEstadoProduto(state) {
  return PRODUTO[state] ?? { rotulo: String(state ?? "desconhecido"), variante: "warning" };
}
