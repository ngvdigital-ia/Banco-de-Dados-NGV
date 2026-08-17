// POST /api/webhooks/google-sheets — a resposta tem que contar a verdade.
//
// Contexto do defeito: o handler antigo respondia SEMPRE `{ success: true, imported, errors }`
// com HTTP 200, inclusive quando importou ZERO. E zero é o caso real de hoje: creatives.project_id
// é NOT NULL REFERENCES projects(id) e `projects` está vazia por decisão registrada — todo insert
// viola a FK. Quem chamava via 200 + "success" e concluía que tinha funcionado.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_REPORTED_ERRORS,
  SHEETS_IMPORT_CODES,
  buildImportResponse,
  classifyRowError,
  describeRowErrorForLog,
  importSheetRows,
  parseSheetsPayload,
  validateRow,
} from "../src/lib/webhooks/google-sheets-import.mjs";

const ROUTE_PATH = new URL("../src/app/api/webhooks/google-sheets/route.ts", import.meta.url);

function goodRow(overrides = {}) {
  return { format: "ugc_fem", platform: "meta", projectId: 7, videoLink: "https://exemplo.test/v/1", ...overrides };
}

// Erro igual ao que o stack real produz: DrizzleQueryError (SQL + params na .message) embrulhando
// o erro do driver Postgres. Ver node_modules/drizzle-orm/errors.js:10-19.
function drizzleFkError(paramsBlob = '7,meta,ugc_fem,https://exemplo.test/v/1,rascunho') {
  const pgError = new Error(
    'insert or update on table "creatives" violates foreign key constraint "creatives_project_id_projects_id_fk"',
  );
  Object.assign(pgError, { code: "23503", constraint: "creatives_project_id_projects_id_fk" });
  const wrapped = new Error(`Failed query: insert into "creatives" (...) values (...)\nparams: ${paramsBlob}`, {
    cause: pgError,
  });
  Object.assign(wrapped, { query: 'insert into "creatives" (...)', params: paramsBlob });
  return wrapped;
}

function drizzleEnumError() {
  const pgError = new Error('invalid input value for enum platform: "facebook"');
  Object.assign(pgError, { code: "22P02" });
  const wrapped = new Error("Failed query: insert into \"creatives\"\nparams: 7,facebook", { cause: pgError });
  Object.assign(wrapped, { params: "7,facebook" });
  return wrapped;
}

// --- Caso 1: tudo importou ---------------------------------------------------------------

test("importou tudo: 200 com success true e imported === received", async () => {
  const inserted = [];
  const res = await importSheetRows({
    body: { rows: [goodRow(), goodRow({ projectId: 8 })] },
    insertRow: async (row) => inserted.push(row),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.received, 2);
  assert.equal(res.body.imported, 2);
  assert.equal(res.body.failed, 0);
  assert.equal(res.body.errors, undefined, "sucesso limpo não carrega errors[]");
  assert.equal(inserted.length, 2);
  assert.deepEqual(inserted[0], {
    projectId: 7,
    platform: "meta",
    format: "ugc_fem",
    videoLink: "https://exemplo.test/v/1",
  });
});

test("lote vazio é 200 honesto: nada foi pedido, nada foi importado", async () => {
  const res = await importSheetRows({ body: { rows: [] }, insertRow: async () => assert.fail("não deve inserir") });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, received: 0, imported: 0, failed: 0 });
});

// --- Caso 2: NADA importou e houve erro (o que mais mentia) ------------------------------

test("nada importou por falha de banco: 500 NOTHING_IMPORTED, success false — nunca mais 200", async () => {
  const res = await importSheetRows({
    body: { rows: [goodRow(), goodRow({ projectId: 8 })] },
    insertRow: async () => {
      throw drizzleFkError();
    },
  });

  assert.equal(res.status, 500, "zero importado com erro de servidor não pode ser 2xx");
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, SHEETS_IMPORT_CODES.NOTHING_IMPORTED);
  assert.equal(res.body.received, 2);
  assert.equal(res.body.imported, 0);
  assert.equal(res.body.failed, 2);
  assert.equal(res.body.errors.length, 2);
  assert.equal(res.body.errors[0].constraint, "creatives_project_id_projects_id_fk");
  assert.equal(res.body.errors[0].pgCode, "23503");
  assert.equal(res.body.errors[0].callerFixable, false, "FK contra tabela vazia não é o chamador que conserta");
});

test("nada importou e TODA falha é do payload: 422, não 500 — o servidor funcionou", async () => {
  const res = await importSheetRows({
    body: { rows: [{ platform: "meta" }, { format: "ugc_fem", platform: "meta", projectId: "doze" }] },
    insertRow: async () => assert.fail("linha inválida não deve chegar ao banco"),
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.code, SHEETS_IMPORT_CODES.PAYLOAD_REJECTED);
  assert.equal(res.body.success, false);
  assert.equal(res.body.imported, 0);
  assert.equal(res.body.failed, 2);
  assert.deepEqual(res.body.errors[0].missing, ["format", "projectId"]);
  assert.deepEqual(res.body.errors[1].invalid, ["projectId"]);
});

test("valor fora do enum (SQLSTATE 22xxx) é culpa do payload: 422", async () => {
  const res = await importSheetRows({
    body: { rows: [goodRow({ platform: "facebook" })] },
    insertRow: async () => {
      throw drizzleEnumError();
    },
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.code, SHEETS_IMPORT_CODES.PAYLOAD_REJECTED);
  assert.equal(res.body.errors[0].pgCode, "22P02");
});

test("mistura de culpa do payload + falha do servidor com zero importado: 500 (o servidor ganha)", async () => {
  let call = 0;
  const res = await importSheetRows({
    body: { rows: [goodRow({ platform: "facebook" }), goodRow()] },
    insertRow: async () => {
      call++;
      throw call === 1 ? drizzleEnumError() : drizzleFkError();
    },
  });
  assert.equal(res.status, 500);
  assert.equal(res.body.code, SHEETS_IMPORT_CODES.NOTHING_IMPORTED);
});

test("erro sem SQLSTATE nenhum não vira culpa do chamador: 500", async () => {
  const res = await importSheetRows({
    body: { rows: [goodRow()] },
    insertRow: async () => {
      throw new Error("fetch failed");
    },
  });
  assert.equal(res.status, 500);
  assert.equal(res.body.errors[0].callerFixable, false);
  assert.equal(res.body.errors[0].pgCode, undefined);
});

// --- Caso 3: parcial ---------------------------------------------------------------------

test("parcial (8 de 10): 200 com success false — falha parcial NÃO é 500", async () => {
  const rows = Array.from({ length: 10 }, (_, i) => goodRow({ projectId: i + 1 }));
  let call = 0;
  const res = await importSheetRows({
    body: { rows },
    insertRow: async () => {
      call++;
      if (call === 3 || call === 7) throw drizzleFkError();
    },
  });

  assert.equal(res.status, 200, "parte das linhas foi persistida: 5xx convidaria retry e duplicaria");
  assert.equal(res.body.success, false, "mas não foi sucesso — o corpo diz isso");
  assert.equal(res.body.code, SHEETS_IMPORT_CODES.PARTIAL_IMPORT);
  assert.equal(res.body.received, 10);
  assert.equal(res.body.imported, 8);
  assert.equal(res.body.failed, 2);
  assert.deepEqual(
    res.body.errors.map((e) => e.row),
    [2, 6],
    "o índice da linha que falhou é o que permite reenviar SÓ ela",
  );
});

test("linha inválida no meio não impede as boas de entrar (parcial continua parcial)", async () => {
  const inserted = [];
  const res = await importSheetRows({
    body: { rows: [goodRow(), { format: "ugc_fem" }, goodRow({ projectId: 9 })] },
    insertRow: async (row) => inserted.push(row),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.imported, 2);
  assert.equal(res.body.failed, 1);
  assert.equal(inserted.length, 2);
});

// --- Caso 4: payload inválido ------------------------------------------------------------

for (const [label, body] of [
  ["sem rows", { linhas: [] }],
  ["rows não-array", { rows: { 0: goodRow() } }],
  ["body null", null],
  ["body array", [goodRow()]],
  ["body string", "rows"],
]) {
  test(`payload inválido (${label}): 400 INVALID_PAYLOAD e nenhuma linha tentada`, async () => {
    const res = await importSheetRows({ body, insertRow: async () => assert.fail("não deve inserir") });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, SHEETS_IMPORT_CODES.INVALID_PAYLOAD);
    assert.equal(parseSheetsPayload(body).kind, "error");
  });
}

// --- PII / valores de célula não voltam pela HTTP ----------------------------------------

test("nenhum valor da linha vaza em errors[]: sem SQL, sem params, sem link de vídeo", async () => {
  const res = await importSheetRows({
    body: { rows: [goodRow({ videoLink: "https://exemplo.test/segredo-do-cliente" })] },
    insertRow: async () => {
      throw drizzleFkError("7,meta,ugc_fem,https://exemplo.test/segredo-do-cliente,rascunho");
    },
  });

  const serialized = JSON.stringify(res.body);
  assert.doesNotMatch(serialized, /segredo-do-cliente/, "link da célula não pode voltar pela resposta");
  assert.doesNotMatch(serialized, /params:/, "message do DrizzleQueryError carrega os params — nunca no corpo");
  assert.doesNotMatch(serialized, /Failed query/);
  assert.doesNotMatch(serialized, /insert into/);
  // O que sobra é identificador de esquema, que é o suficiente pra diagnosticar.
  assert.match(serialized, /creatives_project_id_projects_id_fk/);
});

test("o erro CRU vai pro logger do servidor, não pro corpo", async () => {
  const logged = [];
  const raw = drizzleFkError();
  const res = await importSheetRows({
    body: { rows: [goodRow()] },
    insertRow: async () => {
      throw raw;
    },
    logRowError: (info) => logged.push(info),
  });
  assert.equal(logged.length, 1);
  assert.equal(logged[0].row, 0);
  assert.equal(logged[0].error, raw);
  assert.doesNotMatch(JSON.stringify(res.body), /params:/);
});

test("describeRowErrorForLog usa a mensagem do driver, nunca a do drizzle com os params", () => {
  assert.equal(
    describeRowErrorForLog(drizzleFkError()),
    'insert or update on table "creatives" violates foreign key constraint "creatives_project_id_projects_id_fk"',
  );
  // Embrulho do drizzle sem cause: suprime a mensagem em vez de despejar o lote no log.
  const semCause = new Error("Failed query: insert into x\nparams: 7,segredo");
  Object.assign(semCause, { params: "7,segredo", code: "23503" });
  const linha = describeRowErrorForLog(semCause);
  assert.doesNotMatch(linha, /segredo/);
  assert.match(linha, /detalhe suprimido/);
  assert.equal(describeRowErrorForLog(new Error("fetch failed")), "fetch failed");
  assert.equal(describeRowErrorForLog("string solta"), "Unknown error");
});

// --- Invariantes que travam a regressão --------------------------------------------------

// Esta é a invariante que sustenta "parcial é 200": `db.insert(creatives)` não tem
// `onConflictDoNothing`, então 5xx com linha já gravada convida retry e DUPLICA.
// Varre o ESPAÇO de combinações em vez de escolher tuplas a dedo — uma lista escolhida à mão
// pode ser recortada, sem ninguém perceber, exatamente em volta do ramo que quebra a regra.
// (Foi o que aconteceu: o ramo IMPORT_COUNT_MISMATCH devolvia 500 com imported > 0 e as 4
// tuplas da versão anterior nunca encostavam nele.)
test("INVARIANTE: 5xx só quando imported === 0 — varrendo TODAS as combinações", () => {
  const errOf = (n, callerFixable) =>
    Array.from({ length: n }, (_, i) => ({
      row: i,
      code: callerFixable ? SHEETS_IMPORT_CODES.ROW_INVALID : SHEETS_IMPORT_CODES.ROW_DB_ERROR,
      callerFixable,
    }));

  let comImportado = 0;
  let comZero = 0;

  for (let received = 0; received <= 6; received++) {
    for (let imported = 0; imported <= received; imported++) {
      // failed varia LIVREMENTE, inclusive fora de `imported + failed === received` — é
      // justamente o descasamento que o ramo de mismatch existe pra pegar.
      for (let failed = 0; failed <= received; failed++) {
        for (const callerFixable of [true, false]) {
          const res = buildImportResponse({ received, imported, errors: errOf(failed, callerFixable) });
          const ctx = `received=${received} imported=${imported} failed=${failed} fixable=${callerFixable} → ${res.status} ${res.body.code ?? "ok"}`;

          if (imported > 0) {
            assert.ok(res.status < 500, `5xx com linha já persistida convida retry e duplica: ${ctx}`);
            comImportado++;
          } else {
            comZero++;
          }
          // O corpo nunca pode dizer "deu tudo certo" quando não deu.
          if (failed > 0 || imported !== received) {
            assert.equal(res.body.success, false, `success:true mentindo em ${ctx}`);
          }
        }
      }
    }
  }

  // Se a varredura parar de cobrir os dois lados, ela deixa de provar a invariante.
  assert.ok(comImportado > 40, `poucos casos com imported > 0 (${comImportado})`);
  assert.ok(comZero > 10, `poucos casos com imported === 0 (${comZero})`);
});

test("INVARIANTE: success:true só existe quando failed === 0 E imported === received", () => {
  const ok = buildImportResponse({ received: 3, imported: 3, errors: [] });
  assert.equal(ok.body.success, true);

  // Sumiço silencioso de linha (a própria classe de bug desta rota) grita em vez de passar —
  // mas grita no CORPO, não num 5xx: 2 linhas já entraram, e repetir duplicaria.
  const parcial = buildImportResponse({ received: 3, imported: 2, errors: [] });
  assert.equal(parcial.status, 200);
  assert.equal(parcial.body.success, false);
  assert.equal(parcial.body.code, SHEETS_IMPORT_CODES.IMPORT_COUNT_MISMATCH);

  // Sem nada gravado, aí sim 5xx: repetir é seguro e a falha é do servidor.
  const nadaGravado = buildImportResponse({ received: 3, imported: 0, errors: [] });
  assert.equal(nadaGravado.status, 500);
  assert.equal(nadaGravado.body.code, SHEETS_IMPORT_CODES.IMPORT_COUNT_MISMATCH);
});

test("lote grande e todo quebrado: errors[] é limitado, mas failed continua exato", async () => {
  const total = MAX_REPORTED_ERRORS + 12;
  const res = await importSheetRows({
    body: { rows: Array.from({ length: total }, () => goodRow()) },
    insertRow: async () => {
      throw drizzleFkError();
    },
  });
  assert.equal(res.body.failed, total, "a contagem nunca é truncada");
  assert.equal(res.body.errors.length, MAX_REPORTED_ERRORS);
  assert.equal(res.body.errorsOmitted, 12);
});

test("validateRow aceita projectId numérico em texto (célula de planilha) e recusa o resto", () => {
  assert.deepEqual(validateRow(goodRow({ projectId: "12" })).value.projectId, 12);
  assert.equal(validateRow(goodRow({ projectId: 0 })).ok, false);
  assert.equal(validateRow(goodRow({ projectId: -1 })).ok, false);
  assert.equal(validateRow(goodRow({ projectId: 2147483648 })).ok, false);
  assert.equal(validateRow(null).ok, false);
  assert.equal(validateRow(goodRow({ videoLink: undefined })).value.videoLink, null);
});

test("classifyRowError encontra o SQLSTATE mesmo aninhado, sem carregar mensagem junto", () => {
  const entry = classifyRowError(drizzleFkError(), 4);
  assert.deepEqual(entry, {
    row: 4,
    code: SHEETS_IMPORT_CODES.ROW_DB_ERROR,
    callerFixable: false,
    pgCode: "23503",
    constraint: "creatives_project_id_projects_id_fk",
  });
});

// --- A route continua fina e não repõe o vazamento ---------------------------------------

test("route.ts delega ao módulo e devolve o status decidido por ele", async () => {
  const src = await readFile(ROUTE_PATH, "utf8");
  // Só o código, sem os comentários (que citam as respostas de propósito).
  const code = src.replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /importSheetRows\(\{/);
  assert.match(code, /status: result\.status/);
  assert.doesNotMatch(code, /success: true/, "a route não pode fabricar sucesso por conta própria");
  assert.doesNotMatch(code, /err\.message|error\.message/, "message de erro do banco nunca volta pela route");
  assert.doesNotMatch(code, /errors\.push/, "o array de erros mentiroso saiu daqui de vez");
});

test("route.ts mantém a auth intocada (500 sem secret, 401 se não bater)", async () => {
  const src = await readFile(ROUTE_PATH, "utf8");
  assert.match(src, /"Webhook secret not configured on server" \}, \{ status: 500 \}/);
  assert.match(src, /"Unauthorized" \}, \{ status: 401 \}/);
});
