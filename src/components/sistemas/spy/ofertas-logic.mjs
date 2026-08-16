// Núcleo puro da aba "Ofertas" — porta a lógica de cadastro/edição de
// workspaces/spy-analytics/index.html:900-948 (limpaForm/renderOfertas) e :1472-1496
// (btnAddOferta). Mesma convenção de leitura-logic.mjs: sem estado próprio, sem DOM.

export const CAMPOS_OFERTA = Object.freeze([
  "nome",
  "formato",
  "nicho",
  "idioma",
  "link",
  "cloaker",
  "tipo_produto",
]);

// Campo do patch (snake_case, contrato do wire) -> campo correspondente no SpyOferta lido do
// servidor (camelCase só em tipoProduto — mesma convenção de mutations-client.d.mts).
const CAMPO_PARA_ORIGINAL = Object.freeze({
  nome: "nome",
  formato: "formato",
  nicho: "nicho",
  idioma: "idioma",
  link: "link",
  cloaker: "cloaker",
  tipo_produto: "tipoProduto",
});

function normalizarTexto(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normalizarVazioParaNull(v) {
  const t = normalizarTexto(v);
  return t === "" ? null : t;
}

function normalizarSelect(v) {
  const t = normalizarTexto(v);
  return t === "" ? null : t;
}

// Formulário -> candidato de valores normalizados (mesma forma nos dois sentidos: criação e
// diff de edição), pra nunca duplicar a normalização entre as duas funções abaixo.
function candidatoDoForm(form) {
  return {
    nome: normalizarTexto(form.nome),
    formato: normalizarVazioParaNull(form.formato),
    nicho: normalizarVazioParaNull(form.nicho),
    idioma: normalizarVazioParaNull(form.idioma),
    link: normalizarVazioParaNull(form.link),
    cloaker: normalizarSelect(form.cloaker),
    tipo_produto: normalizarSelect(form.tipoProduto),
  };
}

/**
 * Input pra `createSpyOfertaWithAudit` a partir do formulário. `gerarId` é injetado (não chama
 * crypto.randomUUID() direto) pra manter esta função pura e determinística em teste.
 */
export function construirInputCriacao(form, gerarId) {
  return { id: gerarId(), ...candidatoDoForm(form) };
}

/**
 * Diff entre a oferta como está no servidor (`original`, formato SpyOferta) e o formulário — só os
 * campos que MUDARAM entram no patch devolvido. Nenhuma mudança real -> `{}`.
 *
 * Decisão deliberada (handoff pvs-master, 2026-08-16): o original sempre manda o formulário
 * inteiro como patch, mesmo sem nenhuma mudança (index.html:1484-1489). Aqui não — "salvar" sem
 * diferença nenhuma não deveria disparar PATCH nem gravar linha em module_action_log; ver teste
 * "edição sem alteração não deve chamar a mutação" em
 * tests/sistemas-spy-ofertas-logic.test.mjs.
 */
export function construirPatchEdicao(original, form) {
  const candidato = candidatoDoForm(form);
  const patch = {};
  for (const campo of CAMPOS_OFERTA) {
    const chaveOriginal = CAMPO_PARA_ORIGINAL[campo];
    const valorOriginal = original[chaveOriginal] ?? null;
    const valorNovo = candidato[campo];
    if (valorNovo !== valorOriginal) patch[campo] = valorNovo;
  }
  return patch;
}

/** true quando `patch` não tem nenhum campo — "editar" sem mudar nada. */
export function patchVazio(patch) {
  return Object.keys(patch).length === 0;
}

/**
 * Mesma checagem de duplicidade do original (index.html:1491: nome já existe, case-insensitive).
 * `ignorarId` exclui a própria oferta da checagem (usado durante edição — a oferta pode manter o
 * próprio nome).
 */
export function nomeDuplicado(ofertas, nome, ignorarId) {
  const alvo = normalizarTexto(nome).toLowerCase();
  if (!alvo) return false;
  return ofertas.some((o) => o.id !== ignorarId && o.nome.toLowerCase() === alvo);
}

/** Formulário vazio pra "Cadastrar oferta" / reset após salvar (index.html:902-908). */
export function formularioVazio() {
  return { nome: "", formato: "", nicho: "", idioma: "", cloaker: "", tipoProduto: "", link: "" };
}

/** Formulário preenchido a partir de uma oferta existente — abrir "Editar oferta" (index.html:932-947). */
export function formularioDaOferta(oferta) {
  return {
    nome: oferta.nome,
    formato: oferta.formato ?? "",
    nicho: oferta.nicho ?? "",
    idioma: oferta.idioma ?? "",
    cloaker: oferta.cloaker ?? "",
    tipoProduto: oferta.tipoProduto ?? "",
    link: oferta.link ?? "",
  };
}
