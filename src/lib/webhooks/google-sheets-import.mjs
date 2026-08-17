// Lógica pura do POST /api/webhooks/google-sheets — validação do payload, execução do import
// linha a linha e, principalmente, QUAL VERDADE a resposta conta.
//
// Por que fora da route: o defeito aqui não é o import, é a RESPOSTA. O handler antigo somava
// os erros num array, respondia `{ success: true, imported: 0, errors: [...] }` com HTTP 200 e
// nunca deixava de "dar certo" — inclusive no cenário real de hoje, em que TODO insert falha
// (`creatives.project_id` é NOT NULL REFERENCES projects(id) e `projects` está vazia por
// decisão registrada em src/app/(dashboard)/import/actions.ts:51). Sem Drizzle/Next aqui, então
// os 4 caminhos (tudo · nada · parcial · payload inválido) são testáveis de verdade em
// tests/google-sheets-webhook.test.mjs.
//
// A escolha de status HTTP, e o porquê de cada uma:
//
//   200 — importou tudo (`success: true`).
//   200 — PARCIAL (importou ≥1 e falhou ≥1), com `success: false`. Falha parcial NÃO é 5xx de
//         propósito: parte das linhas foi PERSISTIDA. `db.insert(creatives)` não tem
//         onConflictDoNothing, então um 5xx aqui convidaria o chamador (ou a plataforma) a
//         repetir o lote inteiro e DUPLICAR o que já entrou. A verdade vai no corpo:
//         success/imported/failed/errors. Invariante que os testes travam: 5xx só existe quando
//         `imported === 0` — ou seja, repetir a chamada depois de um 5xx é sempre seguro.
//   422 — nada importou e TODAS as falhas são do payload (campo faltando, projectId não-inteiro,
//         ou dado recusado pelo Postgres como classe 22xxx "data exception", ex.: valor fora do
//         enum). O servidor funcionou; quem manda a planilha é que consegue consertar.
//   500 — nada importou e ao menos UMA falha é do lado de cá (ou é de classe desconhecida). É o
//         caso que mais mentia: hoje 100% do tráfego real cai aqui, por causa da FK contra uma
//         tabela vazia por design — nenhum valor de célula conserta isso. Devolver 4xx mandaria
//         o operador da planilha caçar erro na planilha para sempre; 200 (o comportamento antigo)
//         faria ninguém caçar coisa nenhuma. Desconhecido também cai em 500: culpar o chamador
//         sem prova é a mesma mentira ao contrário.
//
// PII/valores de célula: o array `errors` NUNCA carrega mensagem de driver. Isso não é
// precaução teórica — drizzle-orm 0.45 embrulha toda falha de query em `DrizzleQueryError`,
// cujo `.message` é literalmente `Failed query: <SQL>\nparams: <valores da linha>`
// (node_modules/drizzle-orm/errors.js:10-19). O handler antigo empurrava esse `.message` pro
// corpo da resposta, então cada linha que falhava devolvia o SQL e os valores enviados
// (link de vídeo, ids) de volta pela HTTP. Aqui só saem identificadores de esquema: índice da
// linha, SQLSTATE e nome da constraint. O erro cru vai pro logger injetado (servidor), nunca
// pro corpo.

export const SHEETS_IMPORT_CODES = Object.freeze({
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  ROW_INVALID: "ROW_INVALID",
  ROW_DB_ERROR: "ROW_DB_ERROR",
  PARTIAL_IMPORT: "PARTIAL_IMPORT",
  PAYLOAD_REJECTED: "PAYLOAD_REJECTED",
  NOTHING_IMPORTED: "NOTHING_IMPORTED",
  IMPORT_COUNT_MISMATCH: "IMPORT_COUNT_MISMATCH",
});

// Mesmos 3 campos que o handler antigo exigia por linha.
export const REQUIRED_ROW_FIELDS = Object.freeze(["format", "projectId", "platform"]);

// Teto de entradas detalhadas em `errors[]`. `failed` continua sendo a contagem EXATA — o corte
// é só do detalhamento, pra um lote grande e todo quebrado não virar resposta gigante.
export const MAX_REPORTED_ERRORS = 50;

const MAX_INT4 = 2147483647; // creatives.project_id é integer (int4)

/**
 * @typedef {{ projectId: number, platform: string, format: string, videoLink: string | null }} NormalizedCreativeRow
 * @typedef {{ row: number, code: string, callerFixable: boolean, missing?: string[], invalid?: string[], pgCode?: string, constraint?: string }} RowFailure
 */

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `{ rows: [...] }` é o contrato. Qualquer outra coisa é 400 — e nenhuma linha é tentada.
 *
 * @param {unknown} body
 * @returns {{ kind: "ok", rows: unknown[] } | { kind: "error", status: number, body: Record<string, unknown> }}
 */
export function parseSheetsPayload(body) {
  if (!isPlainObject(body) || !Array.isArray(/** @type {{ rows?: unknown }} */ (body).rows)) {
    return {
      kind: "error",
      status: 400,
      body: {
        success: false,
        error: "Expected { rows: [...] }",
        code: SHEETS_IMPORT_CODES.INVALID_PAYLOAD,
      },
    };
  }
  return { kind: "ok", rows: /** @type {unknown[]} */ (/** @type {{ rows: unknown[] }} */ (body).rows) };
}

/**
 * Validação de linha. Devolve só NOMES de campo — nunca o valor da célula.
 *
 * Fora daqui de propósito: os valores válidos de `platform`/`format` são enums do Postgres.
 * Duplicar as listas aqui criaria uma segunda fonte da verdade que diverge no primeiro `ALTER
 * TYPE`. Valor fora do enum vira erro de linha na hora do insert (SQLSTATE 22P02), e a
 * classificação por classe 22xxx já devolve isso como culpa do payload — sem duplicar nada.
 *
 * @param {unknown} row
 * @returns {{ ok: true, value: NormalizedCreativeRow } | { ok: false, missing: string[], invalid: string[] }}
 */
export function validateRow(row) {
  if (!isPlainObject(row)) {
    return { ok: false, missing: [...REQUIRED_ROW_FIELDS], invalid: [] };
  }

  const candidate = /** @type {Record<string, unknown>} */ (row);
  const missing = REQUIRED_ROW_FIELDS.filter((field) => !candidate[field]);
  const invalid = [];

  // projectId chega de célula de planilha: "12" (string) é aceito e coagido; "doze" não é —
  // e recusar aqui é o que impede uma digitação errada de virar 500 (culpa do servidor).
  let projectId = 0;
  if (!missing.includes("projectId")) {
    const raw = candidate.projectId;
    const asString = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    if (!/^\d+$/.test(asString)) {
      invalid.push("projectId");
    } else {
      projectId = Number(asString);
      if (projectId <= 0 || projectId > MAX_INT4) invalid.push("projectId");
    }
  }

  if (typeof candidate.format !== "string" && !missing.includes("format")) invalid.push("format");
  if (typeof candidate.platform !== "string" && !missing.includes("platform")) invalid.push("platform");

  if (missing.length > 0 || invalid.length > 0) return { ok: false, missing, invalid };

  const videoLink = candidate.videoLink;
  return {
    ok: true,
    value: {
      projectId,
      platform: /** @type {string} */ (candidate.platform),
      format: /** @type {string} */ (candidate.format),
      videoLink: typeof videoLink === "string" && videoLink !== "" ? videoLink : null,
    },
  };
}

// Anda pela cadeia de `cause` porque o erro do driver vem embrulhado (DrizzleQueryError → NeonDbError).
// Só colhe identificador de esquema: SQLSTATE e nome de constraint. Mensagem, SQL e params ficam de fora.
function pgFieldsOf(err) {
  let current = err;
  for (let depth = 0; isPlainObject(current) && depth < 5; depth++) {
    const holder = /** @type {Record<string, unknown>} */ (current);
    const pgCode = typeof holder.code === "string" ? holder.code : null;
    const constraint = typeof holder.constraint === "string" ? holder.constraint : null;
    if (pgCode || constraint) return { pgCode, constraint };
    current = holder.cause;
  }
  return { pgCode: null, constraint: null };
}

/**
 * Classe 22xxx do SQLSTATE = "data exception" (valor fora do enum, texto longo demais, número
 * inválido): o dado que veio é que não serve, e quem manda a planilha conserta. Todo o resto —
 * inclusive 23503 (foreign_key_violation, o caso de hoje) e erro sem código nenhum — conta como
 * lado servidor: não existe célula que faça o insert passar enquanto `projects` estiver vazia.
 *
 * @param {unknown} err
 * @param {number} index
 * @returns {RowFailure}
 */
export function classifyRowError(err, index) {
  const { pgCode, constraint } = pgFieldsOf(err);
  return {
    row: index,
    code: SHEETS_IMPORT_CODES.ROW_DB_ERROR,
    callerFixable: typeof pgCode === "string" && pgCode.startsWith("22"),
    ...(pgCode ? { pgCode } : {}),
    ...(constraint ? { constraint } : {}),
  };
}

/**
 * Linha única pro LOG DO SERVIDOR (não pra resposta). Também não despeja o payload: o
 * `.message` do DrizzleQueryError é `Failed query: <SQL>\nparams: <valores da linha>`, então
 * quando o erro é esse embrulho a mensagem usada é a do driver por baixo (`cause`), que diz o
 * motivo ("violates foreign key constraint ...") sem carregar o lote inteiro junto.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function describeRowErrorForLog(err) {
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause instanceof Error && cause.message) return cause.message;
  // `params` é propriedade própria do DrizzleQueryError: se está lá, a mensagem tem os valores.
  if (isPlainObject(err) && "params" in /** @type {Record<string, unknown>} */ (err)) {
    const { pgCode, constraint } = pgFieldsOf(err);
    return `query falhou (detalhe suprimido) pgCode=${pgCode ?? "?"} constraint=${constraint ?? "?"}`;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

/**
 * A decisão de status/corpo, isolada do I/O.
 *
 * @param {{ received: number, imported: number, errors: RowFailure[] }} args
 * @returns {{ status: number, body: Record<string, unknown> }}
 */
export function buildImportResponse({ received, imported, errors }) {
  const failed = errors.length;
  const reported = errors.slice(0, MAX_REPORTED_ERRORS);
  const omitted = failed - reported.length;
  const detail = {
    received,
    imported,
    failed,
    errors: reported,
    ...(omitted > 0 ? { errorsOmitted: omitted } : {}),
  };

  if (failed === 0) {
    // Guarda contra a própria classe de bug que esta rota tinha: sem erro nenhum, o número TEM
    // que fechar. Se não fechar, alguém sumiu com linha em silêncio — e isso grita, não passa.
    if (imported !== received) {
      // O STATUS depende de já ter linha persistida, e o motivo não é estético.
      // A invariante que sustenta "parcial é 200" é: **5xx só existe quando imported === 0**.
      // `db.insert(creatives)` não tem `onConflictDoNothing`, então 5xx com linha já gravada
      // convida retry e DUPLICA o que entrou. Devolver 500 aqui com `imported > 0` quebrava
      // exatamente essa invariante — o corpo gritava certo e o status mentia.
      // Com linha gravada: 200 `success:false`, que grita igual e não convida retry.
      // Sem nada gravado: 500, porque aí repetir é seguro e a falha é do servidor.
      return {
        status: imported > 0 ? 200 : 500,
        body: {
          success: false,
          error: `Contagem não fecha: ${received} linha(s) recebida(s), ${imported} importada(s), 0 erro(s) registrado(s).`,
          code: SHEETS_IMPORT_CODES.IMPORT_COUNT_MISMATCH,
          received,
          imported,
          failed: 0,
        },
      };
    }
    return { status: 200, body: { success: true, received, imported, failed: 0 } };
  }

  if (imported > 0) {
    return {
      status: 200,
      body: {
        success: false,
        error: `Import parcial: ${imported} de ${received} linha(s) importada(s), ${failed} com erro.`,
        code: SHEETS_IMPORT_CODES.PARTIAL_IMPORT,
        ...detail,
      },
    };
  }

  const allCallerFixable = errors.every((entry) => entry.callerFixable === true);
  if (allCallerFixable) {
    return {
      status: 422,
      body: {
        success: false,
        error: `Nenhuma linha importada: as ${failed} linha(s) enviadas foram recusadas — é o dado enviado que não serve.`,
        code: SHEETS_IMPORT_CODES.PAYLOAD_REJECTED,
        hint: "errors[] aponta o índice da linha e o campo (missing/invalid) ou o SQLSTATE que o banco recusou. Corrigir a planilha e reenviar resolve.",
        ...detail,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      error: `Nenhuma linha importada: ${failed} de ${received} falharam no banco. Reenviar o mesmo payload não resolve — nada foi persistido.`,
      code: SHEETS_IMPORT_CODES.NOTHING_IMPORTED,
      hint: "errors[].constraint / errors[].pgCode identificam a restrição violada; a mensagem completa fica no log do servidor.",
      ...detail,
    },
  };
}

/**
 * Valida o payload, tenta importar linha a linha e devolve status + corpo honestos.
 *
 * @param {object} args
 * @param {unknown} args.body — corpo já desserializado (JSON quebrado é 400 na route)
 * @param {(row: NormalizedCreativeRow) => Promise<unknown>} args.insertRow
 * @param {(info: { row: number, error: unknown }) => void} [args.logRowError] — recebe o erro CRU (servidor); nada disso vai pro corpo
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function importSheetRows({ body, insertRow, logRowError }) {
  const parsed = parseSheetsPayload(body);
  if (parsed.kind === "error") return { status: parsed.status, body: parsed.body };

  const rows = parsed.rows;
  /** @type {RowFailure[]} */
  const errors = [];
  let imported = 0;

  for (let index = 0; index < rows.length; index++) {
    const validation = validateRow(rows[index]);
    if (!validation.ok) {
      errors.push({
        row: index,
        code: SHEETS_IMPORT_CODES.ROW_INVALID,
        callerFixable: true,
        ...(validation.missing.length > 0 ? { missing: validation.missing } : {}),
        ...(validation.invalid.length > 0 ? { invalid: validation.invalid } : {}),
      });
      continue;
    }

    try {
      await insertRow(validation.value);
      imported++;
    } catch (err) {
      errors.push(classifyRowError(err, index));
      if (logRowError) logRowError({ row: index, error: err });
    }
  }

  return buildImportResponse({ received: rows.length, imported, errors });
}
