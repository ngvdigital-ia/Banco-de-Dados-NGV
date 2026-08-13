import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyPayload,
  emitDailyIngest,
  NgvCoreEmitterError,
  normalizeAggregateRow,
  resolveNgvCoreConfig,
  validateNgvCoreUrl,
} from "../src/lib/ngv-core/emitter.mjs";

const WRITER_KEY = "sb_secret_test_key";
const CORE_URL = "https://core.example.com/functions/v1/banco-global-daily-ingest";
const BASE_CONFIG = {
  url: CORE_URL,
  writerKey: WRITER_KEY,
  hostAllowlist: "core.example.com",
};

const SAMPLE_AGGREGATE = {
  offer_tracking_count: 42,
  metrics_snapshot_count: 137,
  latest_metric_at: "2026-08-12T09:00:00.000Z",
  latest_offer_at: "2026-08-12T10:30:00.000Z",
};

function streamBody(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function httpResponse(value, status = 200) {
  return { ok: status >= 200 && status < 300, status, body: streamBody(JSON.stringify(value)) };
}

function neverResolvingFetch() {
  return (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
}

test("buildDailyPayload monta payload canônico sem PII", () => {
  const payload = buildDailyPayload(SAMPLE_AGGREGATE, "2026-08-13T00:00:00.000Z");
  assert.deepEqual(payload, {
    schema_version: 1,
    source: "banco-ngv",
    status: "ready",
    generated_at: "2026-08-13T00:00:00.000Z",
    offer_tracking_count: 42,
    metrics_snapshot_count: 137,
    latest_metric_at: "2026-08-12T09:00:00.000Z",
    latest_offer_at: "2026-08-12T10:30:00.000Z",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "generated_at", "latest_metric_at", "latest_offer_at", "metrics_snapshot_count",
    "offer_tracking_count", "schema_version", "source", "status",
  ]);
});

test("buildDailyPayload ignora chaves extras (PII nunca chega ao payload)", () => {
  const payload = buildDailyPayload(
    { ...SAMPLE_AGGREGATE, email: "person@example.test", token: "do-not-persist" },
    "2026-08-13T00:00:00.000Z",
  );
  assert.equal(JSON.stringify(payload).includes("person@example.test"), false);
  assert.equal(JSON.stringify(payload).includes("do-not-persist"), false);
});

test("buildDailyPayload rejeita contagens e timestamps inválidos", () => {
  for (const aggregate of [
    undefined,
    null,
    {},
    { ...SAMPLE_AGGREGATE, offer_tracking_count: -1 },
    { ...SAMPLE_AGGREGATE, offer_tracking_count: 1.5 },
    { ...SAMPLE_AGGREGATE, metrics_snapshot_count: "não-numérico" },
    { ...SAMPLE_AGGREGATE, latest_metric_at: "not-a-date" },
    { ...SAMPLE_AGGREGATE, latest_offer_at: 123 },
  ]) {
    assert.throws(() => buildDailyPayload(aggregate, "2026-08-13T00:00:00.000Z"), NgvCoreEmitterError, JSON.stringify(aggregate));
  }
  assert.throws(() => buildDailyPayload(SAMPLE_AGGREGATE, "garbage"), NgvCoreEmitterError);
});

test("buildDailyPayload aceita timestamps nulos", () => {
  const payload = buildDailyPayload(
    { ...SAMPLE_AGGREGATE, latest_metric_at: null, latest_offer_at: undefined },
    "2026-08-13T00:00:00.000Z",
  );
  assert.equal(payload.latest_metric_at, null);
  assert.equal(payload.latest_offer_at, null);
});

test("normalizeAggregateRow converte bigint/string e timestamps para o agregado", () => {
  const row = {
    offer_tracking_count: "42",
    metrics_snapshot_count: "137",
    latest_metric_at: new Date("2026-08-12T09:00:00.000Z"),
    latest_offer_at: "2026-08-12T10:30:00.000Z",
  };
  assert.deepEqual(normalizeAggregateRow(row), {
    offer_tracking_count: 42,
    metrics_snapshot_count: 137,
    latest_metric_at: "2026-08-12T09:00:00.000Z",
    latest_offer_at: "2026-08-12T10:30:00.000Z",
  });
});

test("normalizeAggregateRow mapeia nulo para null e rejeita contagens ausentes", () => {
  assert.deepEqual(normalizeAggregateRow({ offer_tracking_count: "0", metrics_snapshot_count: "0", latest_metric_at: null, latest_offer_at: null }), {
    offer_tracking_count: 0,
    metrics_snapshot_count: 0,
    latest_metric_at: null,
    latest_offer_at: null,
  });
  for (const row of [undefined, {}, { metrics_snapshot_count: "1" }, { offer_tracking_count: "x", metrics_snapshot_count: "1" }]) {
    assert.throws(() => normalizeAggregateRow(row), NgvCoreEmitterError, JSON.stringify(row));
  }
});

test("resolveNgvCoreConfig aplica defaults e trava timeout em 10s", () => {
  const config = resolveNgvCoreConfig({ timeoutMs: 60000 });
  assert.equal(config.timeoutMs, 10_000);
  assert.equal(resolveNgvCoreConfig({ timeoutMs: 2500 }).timeoutMs, 2500);
  assert.equal(resolveNgvCoreConfig({ timeoutMs: NaN }).timeoutMs, 10_000);
});

test("validateNgvCoreUrl exige https, path exato, sem query/userinfo e host allowlistado", () => {
  const ok = validateNgvCoreUrl(CORE_URL, "core.example.com");
  assert.equal(ok.hostname, "core.example.com");
  for (const url of [
    "http://core.example.com/functions/v1/banco-global-daily-ingest",
    "https://core.example.com/banco-global-daily-ingest",
    "https://core.example.com/functions/v1/banco-global-daily-ingest?x=1",
    "https://core.example.com/functions/v1/banco-global-daily-ingest#h",
    "https://user:pass@core.example.com/functions/v1/banco-global-daily-ingest",
    "https://evil.example.com/functions/v1/banco-global-daily-ingest",
    "not a url",
  ]) {
    assert.throws(() => validateNgvCoreUrl(url, "core.example.com"), NgvCoreEmitterError, url);
  }
});

test("emitDailyIngest falha com WRITER_KEY ausente antes de qualquer rede", async () => {
  let calls = 0;
  await assert.rejects(emitDailyIngest(SAMPLE_AGGREGATE, {
    config: { url: CORE_URL, writerKey: "", hostAllowlist: "core.example.com" },
    fetchImpl: async () => { calls += 1; throw new Error("não deveria chamar rede"); },
  }), (error) => error instanceof NgvCoreEmitterError && error.code === "NGV_CORE_WRITER_KEY_MISSING");
  assert.equal(calls, 0);
});

test("emitDailyIngest valida URL antes da rede", async () => {
  let calls = 0;
  await assert.rejects(emitDailyIngest(SAMPLE_AGGREGATE, {
    config: { url: "https://evil.example.com/functions/v1/banco-global-daily-ingest", writerKey: WRITER_KEY, hostAllowlist: "core.example.com" },
    fetchImpl: async () => { calls += 1; throw new Error("não deveria chamar rede"); },
  }), (error) => error instanceof NgvCoreEmitterError && error.code === "NGV_CORE_HOST_NOT_ALLOWLISTED");
  assert.equal(calls, 0);
});

test("emitDailyIngest faz POST com cabeçalho privado, redirect manual e só 2xx vira sucesso", async () => {
  const captured = [];
  const fetchImpl = async (url, options) => {
    captured.push({ url, options });
    return httpResponse({ ok: true }, 200);
  };
  const result = await emitDailyIngest(SAMPLE_AGGREGATE, { config: BASE_CONFIG, fetchImpl, generatedAt: "2026-08-13T00:00:00.000Z" });

  assert.equal(result.kind, "success");
  assert.equal(result.http_status, 200);
  assert.equal(result.offer_tracking_count, 42);
  assert.equal(result.metrics_snapshot_count, 137);

  const { url, options } = captured[0];
  assert.equal(String(url), CORE_URL);
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "manual");
  assert.equal(options.headers["x-ngv-core-key"], WRITER_KEY);
  assert.equal(options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), {
    schema_version: 1,
    source: "banco-ngv",
    status: "ready",
    generated_at: "2026-08-13T00:00:00.000Z",
    offer_tracking_count: 42,
    metrics_snapshot_count: 137,
    latest_metric_at: "2026-08-12T09:00:00.000Z",
    latest_offer_at: "2026-08-12T10:30:00.000Z",
  });
});

test("emitDailyIngest rejeita não-2xx (403, 500) e nunca expõe key/payload", async () => {
  for (const status of [403, 500, 404]) {
    const fetchImpl = async () => httpResponse({ error: "nope" }, status);
    await assert.rejects(emitDailyIngest(SAMPLE_AGGREGATE, { config: BASE_CONFIG, fetchImpl }), (error) => {
      assert.ok(error instanceof NgvCoreEmitterError);
      assert.equal(error.code, `INGEST_REJECTED_${status}`);
      assert.equal(String(error.message).includes(WRITER_KEY), false);
      return true;
    });
  }
});

test("emitDailyIngest respeita timeout (10s máximo) e mapeia para NGV_CORE_TIMEOUT", async () => {
  const fetchImpl = neverResolvingFetch();
  await assert.rejects(emitDailyIngest(SAMPLE_AGGREGATE, {
    config: { ...BASE_CONFIG, timeoutMs: 5 },
    fetchImpl,
  }), (error) => error instanceof NgvCoreEmitterError && error.code === "NGV_CORE_TIMEOUT");
});

test("emissor não registra nem devolve key ou payload PII", async () => {
  const captured = [];
  const fetchImpl = async (url, options) => {
    captured.push(options);
    return httpResponse({ ok: true }, 200);
  };
  const aggregate = { ...SAMPLE_AGGREGATE, email: "person@example.test" };
  const result = await emitDailyIngest(aggregate, { config: BASE_CONFIG, fetchImpl });

  assert.equal(JSON.stringify(result).includes(WRITER_KEY), false);
  assert.equal(JSON.stringify(result).includes("person@example.test"), false);
  assert.equal(captured[0].body.includes(WRITER_KEY), false);
  assert.equal(captured[0].body.includes("person@example.test"), false);
});
