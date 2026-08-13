import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/operacao/commands/route.ts", import.meta.url);
const FEATURE_PATH = new URL("../src/lib/operacao/feature.ts", import.meta.url);

const FLAG_GUARD = /if \(!isOperationCommandsEnabled\)/;

test("rota aplica flag da feature antes de qualquer autenticação", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const post = source.indexOf("export async function POST(request: Request)");
  const flag = source.indexOf("if (!isOperationCommandsEnabled)");
  const auth = source.indexOf("await requireOperationOperator()");

  assert.ok(post >= 0, "POST ausente");
  assert.ok(flag > post, "flag server-side deve abrir o POST");
  assert.ok(auth > flag, "flag deve vir antes da autenticação");
  assert.ok(FLAG_GUARD.test(source), "guarda fail-closed da flag ausente");
});

test("rota rejeita 404 com flag ausente por padrão (nunca executa sem env)", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const featureSource = await readFile(FEATURE_PATH, "utf8");
  assert.match(featureSource, /OPERATION_COMMANDS_ENABLED === ["']true["']/);
  assert.match(
    source,
    /import \{[^}]*isOperationCommandsEnabled[^}]*\} from ["']@\/lib\/operacao\/feature["']/,
  );
  assert.doesNotMatch(source, /OPERATION_COMMANDS_ENABLED/);
});

test("auth acontece antes do envelope/Content-Type, corpo e parser", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const auth = source.indexOf("await requireOperationOperator()");
  const envelope = source.indexOf("const envelopeError = validateRequestEnvelope(request);");
  const body = source.indexOf("const read = await readBodyWithBudget(request, MAX_COMMAND_BODY_BYTES);");
  const secrets = source.indexOf("const sensitive = detectSensitivePayload(raw);");
  const zod = source.indexOf("const parsed = safeParseOperationCommand(raw);");

  assert.ok(auth >= 0 && envelope > auth, "envelope deve vir depois da auth");
  assert.ok(body > envelope, "corpo deve vir depois do envelope");
  assert.ok(secrets > body, "secrets raw deve ser avaliado após ler corpo");
  assert.ok(zod > secrets, "Zod deve vir depois da detecção de secrets");
});

test("rota só propaga 401/403 da autenticação; demais erros viram 500 seguro", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /candidate === 401 \|\| candidate === 403 \? candidate : 500/);
  assert.doesNotMatch(source, /const status = error instanceof Error && "status" in error/);
});

test("Content-Type application/json é exigido e rejeita outros com 415", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /content-type/);
  assert.match(source, /application\/json/);
  assert.match(source, /415/);
  assert.match(source, /UNSUPPORTED_MEDIA_TYPE/);
  assert.match(source, /contentType\.split\(";"\)\[0\]\.trim\(\)\.toLowerCase\(\)/);
});

test("same-origin é opcional: Origin ausente passa e presente precisa bater com o request", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /const origin = request\.headers\.get\("origin"\);/);
  assert.match(source, /if \(origin !== null\)/);
  assert.match(source, /new URL\(request\.url\)\.origin/);
  assert.match(source, /403/);
  assert.match(source, /ORIGIN_MISMATCH/);
});

test("corpo é lido em streaming via getReader, sem request.text()", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /const body = request\.body;/);
  assert.match(source, /const reader = body\.getReader\(\);/);
  assert.match(source, /reader\.read\(\)/);
  assert.match(source, /reader\.cancel\(\)/);
  assert.match(source, /TextDecoder\("utf-8"\)\.decode\(/);
  assert.doesNotMatch(source, /await request\.text\(\)/);
  assert.doesNotMatch(source, /await request\.json\(\)/);
});

test("Content-Length declarado sopra o orçamento e o corpo é contado em bytes (64KiB)", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /const MAX_COMMAND_BODY_BYTES = 64 \* 1024;/);
  assert.match(source, /content-length/);
  assert.match(source, /const declared = Number\(contentLength\);/);
  assert.match(source, /declared > budget/);
  assert.match(source, /total \+= value\.byteLength/);
  assert.match(source, /total > budget/);
  assert.match(source, /413/);
  assert.match(source, /PAYLOAD_TOO_LARGE/);
  assert.match(source, /BODY_UNREADABLE/);
  assert.match(source, /400/);
});

test("secrets raw são detectados antes do Zod e o payload nunca vira eco de erro", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const secrets = source.indexOf("const sensitive = detectSensitivePayload(raw);");
  const zod = source.indexOf("const parsed = safeParseOperationCommand(raw);");
  assert.ok(secrets >= 0 && zod > secrets, "detecção de secrets deve anteceder o Zod");
  assert.match(source, /422/);
  assert.match(source, /SENSITIVE_PAYLOAD/);
  assert.match(source, /matches: sensitive\.matches/);
  assert.doesNotMatch(source, /JSON\.stringify\(raw\)/);
});

test("rota não usa fetch, request.text(), nem importa integrações externas", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /request\.text\s*\(/);
  for (const integration of ["vturb", "utmify", "clickup-api", "webhooks/", "cron/", "agentes/"]) {
    assert.doesNotMatch(source, new RegExp(`from ["']@\\/${integration}`), `import não esperado: ${integration}`);
  }
  assert.match(source, /import \{ db \} from ["']@\/db["'];/);
  assert.match(source, /from ["']@\/db\/schema["'];/);
});

test("rotas-solo mantêm runtime nodejs e não expõem a flag pública no corpo", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /export const runtime = ["']nodejs["'];/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_OPERATION_COMMANDS_ENABLED/);
});

test("inserção usa onConflictDoNothing por commandId (idempotência no banco)", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /\.insert\(operationCommands\)/);
  assert.match(source, /\.values\(insertRow\)/);
  assert.match(source, /\.onConflictDoNothing\(\{ target: operationCommands\.commandId \}\)/);
  assert.match(source, /\.returning\(\{ id: operationCommands\.id \}\)/);
  assert.doesNotMatch(source, /\.onConflictDoUpdate\(/);
});

test("dispatch só ocorre para NEW/REPLAY e colisão local não chama adapter", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /response\(202, \{\s*\n\s*status: ["']accepted["']/s);
  assert.match(source, /idempotency: IDEMPOTENCY_NEW/);
  assert.match(source, /response\(200, \{\s*\n\s*status: ["']replay["']/s);
  assert.match(source, /idempotency: IDEMPOTENCY_REPLAY/);
  assert.match(source, /response\(409, \{/);
  assert.match(source, /COMMAND_ID_CONFLICT/);
  assert.match(source, /isOperationCommandDispatchEnabled/);
  assert.match(source, /dispatchAndRespond\(command, "new"\)/);
  assert.match(source, /dispatchAndRespond\(command, "replay"\)/);
  assert.match(source, /dispatch: false/);
  assert.match(source, /dispatch: true/);
});

test("rota despacha após ledger e responde queued/receipt sem afirmar execução", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.doesNotMatch(source, /from ["']@\/lib\/[^"']*n8n[^"']*["']/);
  assert.doesNotMatch(source, /N8N_/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /executeCommand|runOutbox|\.clickup\.|clickup\.com/i);
  assert.match(source, /dispatchOperationCommand/);
  assert.match(source, /status: "queued"/);
  assert.match(source, /receipt/);
  assert.match(source, /COMMAND_DISPATCH_FAILED/);
  assert.match(source, /response\(503/);
});

test("feature.ts guarda a flag com typeof window para não vazar no client", async () => {
  const source = await readFile(FEATURE_PATH, "utf8");
  assert.match(source, /isOperationCommandsEnabled/);
  assert.match(source, /typeof window === ["']undefined["']/);
  assert.match(source, /process\.env\.OPERATION_COMMANDS_ENABLED === ["']true["']/);
  assert.match(source, /isOperationCommandDispatchEnabled/);
  assert.doesNotMatch(source, /server-only/);
});

test("colisão remota retorna 409 somente após dispatch elegível NEW ou REPLAY", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const helper = source.indexOf("async function dispatchAndRespond");
  const collision = source.indexOf("receipt.http_status === 409", helper);
  assert.ok(helper >= 0 && collision > helper);
  assert.match(source.slice(helper), /response\(409, \{/);
  assert.match(source.slice(helper), /COMMAND_ID_COLLISION/);
  assert.match(source.slice(helper), /action: command\.action/);
  assert.match(source.slice(helper), /dispatch: true/);
  assert.match(source, /dispatchAndRespond\(command, "new"\)/);
  assert.match(source, /dispatchAndRespond\(command, "replay"\)/);
});
