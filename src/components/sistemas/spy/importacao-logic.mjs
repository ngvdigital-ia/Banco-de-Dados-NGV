// Núcleo puro de importar/exportar da aba "Dados e critérios" — porta
// workspaces/spy-analytics/index.html:1537-1583 (parse da planilha colada) e :1605-1614
// (exportação CSV/JSON). Sem DOM/Blob/FileReader aqui de propósito — essas APIs são do browser e
// ficam no componente .tsx; este módulo só transforma texto <-> estruturas de dados, testável via
// `node --test`.

export const FORMATOS_CONHECIDOS = Object.freeze([
  "vsl",
  "quiz",
  "página de vendas",
  "pagina de vendas",
  "advertorial",
  "outro",
]);

function normalizarPeriodo(v) {
  const t = (v ?? "").toString().trim().toLowerCase();
  return ["noite", "n", "nite", "pm", "tarde"].includes(t) ? "noite" : "manha";
}

function normalizarData(v) {
  const t = (v ?? "").toString().trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function encontrarLeitura(lista, ofertaId, data, periodo) {
  return lista.find((l) => l.ofertaId === ofertaId && l.data === data && l.periodo === periodo) ?? null;
}

/**
 * Parseia o texto colado (planilha) contra o estado ATUAL de ofertas/leituras — devolve o que
 * precisa ser criado/atualizado no servidor, sem mutar nenhum array recebido (função pura).
 * `gerarId` injetado (mesma razão de leitura-logic.mjs/ofertas-logic.mjs: determinismo em teste).
 *
 * Formato de linha (index.html:461): `oferta ; nicho ; idioma ; formato ; data ; periodo ;
 * anuncios` — separador vírgula, ponto-e-vírgula ou tab; a coluna formato é opcional (detectada
 * por estar na lista fechada FORMATOS_CONHECIDOS).
 */
export function parseImportacao(texto, ofertasExistentes, leiturasExistentes, gerarId) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const ofertasNovas = [];
  const ofertasEditadas = [];
  const leiturasTocadas = [];
  let ignoradas = 0;

  // Cópia local só pra resolver duplicatas DENTRO do próprio texto colado (duas linhas da mesma
  // oferta nova) sem mutar o array recebido de `ofertasExistentes`.
  const ofertasConhecidas = ofertasExistentes.map((o) => ({ ...o }));

  linhas.forEach((linha, i) => {
    const c = linha.split(/\t|;|,/).map((x) => x.trim());
    if (i === 0 && /oferta/i.test(c[0] ?? "") && /nicho|data|idioma|formato/i.test(linha)) return;
    const [nome, nicho, idioma] = c;
    if (!nome) {
      ignoradas++;
      return;
    }

    const temFormato = c[3] && FORMATOS_CONHECIDOS.includes(c[3].toLowerCase());
    const formato = temFormato ? c[3] : "";
    const [dataBruta, perBruto, adsBruto] = temFormato ? [c[4], c[5], c[6]] : [c[3], c[4], c[5]];

    let oferta = ofertasConhecidas.find((o) => o.nome.toLowerCase() === nome.toLowerCase());
    if (!oferta) {
      oferta = { id: gerarId(), nome, formato, nicho: nicho || "", idioma: idioma || "", link: "" };
      ofertasConhecidas.push(oferta);
      ofertasNovas.push(oferta);
    } else {
      const patch = {};
      if (nicho && !oferta.nicho) patch.nicho = nicho;
      if (idioma && !oferta.idioma) patch.idioma = idioma;
      if (formato && !oferta.formato) patch.formato = formato;
      if (Object.keys(patch).length) {
        Object.assign(oferta, patch);
        if (!ofertasEditadas.find((o) => o.id === oferta.id)) ofertasEditadas.push(oferta);
      }
    }

    const data = normalizarData(dataBruta);
    const ads = Number.parseInt(String(adsBruto ?? "").replace(/\D/g, ""), 10);
    if (data === null || Number.isNaN(ads)) {
      if (c.length > 3) ignoradas++;
      return;
    }
    const periodo = normalizarPeriodo(perBruto);

    const jaTocada = encontrarLeitura(leiturasTocadas, oferta.id, data, periodo);
    const existente = jaTocada ?? encontrarLeitura(leiturasExistentes, oferta.id, data, periodo);
    if (existente) {
      const atualizada = { ...existente, ads };
      const idx = leiturasTocadas.indexOf(jaTocada);
      if (idx >= 0) leiturasTocadas[idx] = atualizada;
      else leiturasTocadas.push(atualizada);
    } else {
      leiturasTocadas.push({ id: gerarId(), ofertaId: oferta.id, data, periodo, ads });
    }
  });

  return { ofertasNovas, ofertasEditadas, leiturasTocadas, ignoradas };
}

/** CSV `oferta;nicho;idioma;formato;data;periodo;anuncios` — idêntico a index.html:1605-1611. */
export function construirCsv(ofertas, leituras) {
  const mapaOferta = new Map(ofertas.map((o) => [o.id, o]));
  const linhas = ["oferta;nicho;idioma;formato;data;periodo;anuncios"];
  [...leituras]
    .sort((a, b) => {
      const chave = (l) => l.data + (l.periodo === "manha" ? "A" : "B");
      return chave(a) < chave(b) ? -1 : 1;
    })
    .forEach((l) => {
      const o = mapaOferta.get(l.ofertaId);
      if (!o) return;
      linhas.push([o.nome, o.nicho ?? "", o.idioma ?? "", o.formato ?? "", l.data, l.periodo, l.ads].join(";"));
    });
  return linhas.join("\n");
}

/** Valida o shape mínimo de um arquivo de backup restaurado (index.html:1622-1624). */
export function backupValido(objeto) {
  return Boolean(objeto) && typeof objeto === "object" && Array.isArray(objeto.ofertas) && Array.isArray(objeto.leituras);
}
