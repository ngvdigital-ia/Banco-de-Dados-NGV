import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = new URL("../src/app/api/cron/sync-ngv-core/route.ts", import.meta.url);
const EMITTER_PATH = new URL("../src/lib/ngv-core/emitter.mjs", import.meta.url);

test("rota expõe GET com auth timing-safe (sha256 + timingSafeEqual)", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /export async function GET\(request: Request\)/);
  assert.match(source, /import \{ createHash, timingSafeEqual \} from ["']node:crypto["']/);
  assert.match(source, /createHash\(["']sha256["']\)/);
  assert.match(source, /timingSafeEqual\(/);
  assert.match(source, /if \(!expected \|\| !secureEqual\(authHeader, `Bearer \$\{expected\}`\)\)/);
  assert.match(source, /status: 401/);
});

test("auth precede o gate 503 e o gate precede o banco", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const auth = source.indexOf("secureEqual(authHeader");
  const gate = source.indexOf("if (!writerKey)");
  const dbCall = source.indexOf("db.execute");
  assert.ok(auth >= 0 && gate > auth, "auth deve vir antes do gate");
  assert.ok(dbCall > gate, "gate 503 deve vir antes de tocar o banco");
  assert.match(source, /process\.env\.NGV_CORE_BANCO_WRITER_KEY \?\? process\.env\.NGV_CORE_WRITER_KEY/);
  assert.match(source, /NGV_CORE_WRITER_KEY not configured/);
  assert.match(source, /status: 503/);
});

test("única query agregada read-only com contagens e MAX(created_at)", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.equal(source.match(/db\.execute/g)?.length ?? 0, 1);
  assert.match(source, /\(SELECT COUNT\(\*\) FROM offer_tracking\)\s+AS offer_tracking_count/);
  assert.match(source, /\(SELECT COUNT\(\*\) FROM metrics_snapshots\)\s+AS metrics_snapshot_count/);
  assert.match(source, /\(SELECT MAX\(created_at\) FROM metrics_snapshots\)\s+AS latest_metric_at/);
  assert.match(source, /\(SELECT MAX\(created_at\) FROM offer_tracking\)\s+AS latest_offer_at/);
  assert.doesNotMatch(source, /db\.(insert|update|delete)\s*\(/);
});

test("rota delega rede ao emitter e não chama fetch nem loga key/payload", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /NGV_CORE_WRITER_KEY\)`/); // nunca interpola o valor da key
  assert.doesNotMatch(source, /console\.(log|info)\([^)]*payload/i);
  assert.match(source, /import \{[\s\S]*emitDailyIngest[\s\S]*\} from ["']@\/lib\/ngv-core\/emitter\.mjs["']/);
  assert.match(source, /normalizeAggregateRow\(rows\.rows\[0\]\)/);
});

test("erros respondem com código seguro (500) e importam NgvCoreEmitterError", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /NgvCoreEmitterError/);
  assert.match(source, /error instanceof NgvCoreEmitterError \? error\.code : ["']NGV_CORE_INTERNAL["']/);
  assert.match(source, /status: 500/);
});

test("rota-solo mantém runtime nodejs", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /export const runtime = ["']nodejs["']/);
});

test("emitter só considera 2xx sucesso, redirect manual e timeout de 10s", async () => {
  const source = await readFile(EMITTER_PATH, "utf8");
  assert.match(source, /method: ["']POST["']/);
  assert.match(source, /redirect: ["']manual["']/);
  assert.match(source, /NGV_CORE_TIMEOUT_MS = 10_000/);
  assert.match(source, /if \(!response\.ok\) fail\(`INGEST_REJECTED_\$\{response\.status\}`\)/);
  assert.match(source, /headers: \{\s*\n\s*["']content-type["']: ["']application\/json["'],\s*\n\s*["']x-ngv-core-key["']: config\.writerKey/s);
  assert.doesNotMatch(source, /console\.(log|info|error)/);
  assert.match(source, /ngv-core\/emitter|banco-global-daily-ingest/);
});

test("emitter nunca registra writerKey nem payload (sem log e sem eco em erro)", async () => {
  const source = await readFile(EMITTER_PATH, "utf8");
  assert.doesNotMatch(source, /console\.(log|info|error|warn)/);
  assert.doesNotMatch(source, /JSON\.stringify\(payload\)\s*\)/); // payload não vira log
  assert.match(source, /NGV_CORE_WRITER_KEY_MISSING/);
  assert.match(source, /NGV_CORE_TIMEOUT/);
});
