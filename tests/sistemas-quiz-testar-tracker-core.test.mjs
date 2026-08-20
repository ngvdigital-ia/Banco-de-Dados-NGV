import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYTICS_ALLOWED_FUNNEL_IDS_VAR,
  ANALYTICS_ALLOWED_ORIGINS_VAR,
  ANALYTICS_ALLOWED_PROJECT_IDS_VAR,
  QUIZ_TRACK_PATH,
  TestarTrackerError,
  checkTrackerOrigin,
  handleTestarTrackerRequest,
  normalizeFunnelOrigin,
  translateTrackerForbidden,
  validateTrackerUrl,
} from "../src/lib/sistemas/quiz/testar-tracker-core.mjs";

const CORE_PATH = new URL("../src/lib/sistemas/quiz/testar-tracker-core.mjs", import.meta.url);
const ROUTE_PATH = new URL("../src/app/api/sistemas/quiz/testar-tracker/route.ts", import.meta.url);

const HOST = "fake-tracker.example";
const TRACKER_ORIGIN = `https://${HOST}`;
const CONFIG = { trackerOrigin: TRACKER_ORIGIN, hostAllowlist: HOST };

const FUNNEL_ORIGIN = "https://roxyfox.online";
const PAINEL_ORIGIN = "https://banco.ngvdigital.com.br";

// Mensagens 403 CRUAS exatamente como emitidas por
// workspaces/ofertas-ngv/quiz-analytics/server.js (assertAllowedTrackOrigin e
// assertAllowedProjectAndFunnel) — confirmadas nesta sessão, não de memória.
const RAW_403_ORIGIN = "Origin is not allowed for analytics tracking. Add the exact origin to ANALYTICS_ALLOWED_ORIGINS.";
const RAW_403_PROJECT = "Tracking project_id is not in ANALYTICS_ALLOWED_PROJECT_IDS.";
const RAW_403_FUNNEL = "Tracking funnel_id is not in ANALYTICS_ALLOWED_FUNNEL_IDS.";

function mockFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return responder(url, init);
  };
  return { fetchImpl, calls };
}

// ── 1. Tradução do 403 nomeia a allowlist certa (as três) ────────────────────────────────

test("translateTrackerForbidden nomeia ANALYTICS_ALLOWED_ORIGINS pro 403 de origin", () => {
  const result = translateTrackerForbidden(RAW_403_ORIGIN, FUNNEL_ORIGIN);
  assert.equal(result.envVar, ANALYTICS_ALLOWED_ORIGINS_VAR);
  assert.match(result.message, /ANALYTICS_ALLOWED_ORIGINS/);
  assert.match(result.message, new RegExp(FUNNEL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(result.message, /^403/);
  assert.doesNotMatch(result.message, /^Forbidden$/i);
});

test("translateTrackerForbidden nomeia ANALYTICS_ALLOWED_PROJECT_IDS pro 403 de project_id", () => {
  const result = translateTrackerForbidden(RAW_403_PROJECT, "v-spot");
  assert.equal(result.envVar, ANALYTICS_ALLOWED_PROJECT_IDS_VAR);
  assert.match(result.message, /ANALYTICS_ALLOWED_PROJECT_IDS/);
  assert.match(result.message, /v-spot/);
});

test("translateTrackerForbidden nomeia ANALYTICS_ALLOWED_FUNNEL_IDS pro 403 de funnel_id", () => {
  const result = translateTrackerForbidden(RAW_403_FUNNEL, "principal");
  assert.equal(result.envVar, ANALYTICS_ALLOWED_FUNNEL_IDS_VAR);
  assert.match(result.message, /ANALYTICS_ALLOWED_FUNNEL_IDS/);
  assert.match(result.message, /principal/);
});

test("translateTrackerForbidden nunca devolve '403 Forbidden' nu, nem pra mensagem desconhecida", () => {
  for (const raw of ["", "Forbidden", "403", null, undefined, "algo totalmente diferente"]) {
    const result = translateTrackerForbidden(raw, "x");
    assert.notEqual(result.message.trim(), "403 Forbidden");
    assert.notEqual(result.message.trim(), "Forbidden");
    assert.ok(result.message.length > 20, `mensagem devia explicar o problema: "${result.message}"`);
    // fallback ainda nomeia as três allowlists conhecidas, pro operador saber onde olhar
    assert.match(result.message, /ANALYTICS_ALLOWED_ORIGINS/);
    assert.match(result.message, /ANALYTICS_ALLOWED_PROJECT_IDS/);
    assert.match(result.message, /ANALYTICS_ALLOWED_FUNNEL_IDS/);
  }
});

// ── 2. O Origin da chamada é o domínio DIGITADO, nunca o do painel ───────────────────────

test("checkTrackerOrigin manda o header Origin com o domínio do FUNIL, não o do painel", async () => {
  const { fetchImpl, calls } = mockFetch(async () => new Response(null, { status: 204 }));

  await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, fetchImpl });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.origin, FUNNEL_ORIGIN);
  assert.notEqual(calls[0].init.headers.origin, PAINEL_ORIGIN);
  assert.equal(calls[0].init.method, "OPTIONS");
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(calls[0].url, `${TRACKER_ORIGIN}${QUIZ_TRACK_PATH}`);
});

test("handleTestarTrackerRequest propaga o domínio digitado (não o do painel) até o fetch", async () => {
  const { fetchImpl, calls } = mockFetch(async () => new Response(null, { status: 204 }));

  const result = await handleTestarTrackerRequest(
    { projectId: "v-spot", funnelId: "principal", pageId: "presell", origin: FUNNEL_ORIGIN },
    { ...CONFIG, fetchImpl },
  );

  assert.equal(result.status, 200);
  assert.equal(calls[0].init.headers.origin, FUNNEL_ORIGIN);
  assert.equal(result.body.origin.value, FUNNEL_ORIGIN);
  assert.equal(result.body.origin.ok, true);
});

test("nunca manda method POST pro tracker — só OPTIONS (código-fonte, guarda extra contra regressão)", async () => {
  const source = await readFile(CORE_PATH, "utf8");
  assert.doesNotMatch(source, /method:\s*["']POST["']/, "um POST bem-sucedido gravaria um evento real no quiz-analytics");
  assert.match(source, /method:\s*["']OPTIONS["']/);
});

// ── 3. Regra dura: project_id e funnel_id NUNCA aparecem como "checked" ──────────────────

test("handleTestarTrackerRequest nunca finge verificar project_id/funnel_id (checked:false sempre)", async () => {
  const { fetchImpl } = mockFetch(async () => new Response(null, { status: 204 }));

  const result = await handleTestarTrackerRequest(
    { projectId: "v-spot", funnelId: "principal", pageId: "presell", origin: FUNNEL_ORIGIN },
    { ...CONFIG, fetchImpl },
  );

  assert.equal(result.body.projectId.checked, false);
  assert.equal(result.body.projectId.envVar, ANALYTICS_ALLOWED_PROJECT_IDS_VAR);
  assert.match(result.body.projectId.message, /[Nn]ão dá pra verificar|[Nn]ão verificável/);
  assert.equal(result.body.funnelId.checked, false);
  assert.equal(result.body.funnelId.envVar, ANALYTICS_ALLOWED_FUNNEL_IDS_VAR);
  assert.match(result.body.funnelId.message, /[Nn]ão dá pra verificar|[Nn]ão verificável/);
  // mesmo quando a origin É liberada, project/funnel continuam não verificados —
  // um "ok" geral aqui seria o falso positivo que esta tarefa existe pra matar
  assert.equal(result.body.origin.checked, true);
});

// ── 4. 403 real do tracker chega traduzido até a resposta da rota ────────────────────────

test("checkTrackerOrigin traduz o 403 real (origin bloqueada) com o envVar certo", async () => {
  const { fetchImpl } = mockFetch(
    async () => new Response(JSON.stringify({ ok: false, error: RAW_403_ORIGIN }), { status: 403 }),
  );

  const result = await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, fetchImpl });

  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN");
  assert.equal(result.status, 403);
  assert.equal(result.envVar, ANALYTICS_ALLOWED_ORIGINS_VAR);
  assert.match(result.message, /ANALYTICS_ALLOWED_ORIGINS/);
});

test("204 (origin liberada) vira ok:true", async () => {
  const { fetchImpl } = mockFetch(async () => new Response(null, { status: 204 }));
  const result = await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.code, "OK");
  assert.equal(result.checked, true);
});

test("status inesperado (nem 204 nem 403) não vira sucesso silencioso", async () => {
  const { fetchImpl } = mockFetch(async () => new Response("erro", { status: 500 }));
  const result = await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNEXPECTED_STATUS");
  assert.equal(result.status, 500);
});

test("redirect (3xx ou opaqueredirect) não vira sucesso", async () => {
  const { fetchImpl } = mockFetch(async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } }));
  const result = await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNEXPECTED_REDIRECT");
});

// ── 5. Timeout via AbortController — fetch que nunca resolve não pendura ─────────────────

test("fetch que NUNCA resolve termina por timeout do AbortController próprio", async () => {
  let recebeuSignal = null;
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      recebeuSignal = init.signal;
      init.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      });
    });

  const inicio = Date.now();
  const result = await checkTrackerOrigin(FUNNEL_ORIGIN, { ...CONFIG, timeoutMs: 25, fetchImpl });
  const duracao = Date.now() - inicio;

  assert.equal(result.ok, false);
  assert.equal(result.code, "TIMEOUT");
  assert.ok(recebeuSignal instanceof AbortSignal, "o fetch precisa receber o signal do nosso AbortController");
  assert.equal(recebeuSignal.aborted, true, "o AbortController precisa ter disparado");
  assert.ok(duracao < 2000, `não pode pendurar — levou ${duracao}ms pra um timeout de 25ms`);
});

test("timeout no meio do handleTestarTrackerRequest vira 200 com TIMEOUT, não exceção vazando pra rota", async () => {
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  const result = await handleTestarTrackerRequest(
    { projectId: "v-spot", funnelId: "principal", pageId: "presell", origin: FUNNEL_ORIGIN },
    { ...CONFIG, timeoutMs: 25, fetchImpl },
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.origin.code, "TIMEOUT");
  assert.equal(result.body.origin.ok, false);
});

test("timeout é limitado a 8s mesmo se pedirem mais", async () => {
  const source = await readFile(CORE_PATH, "utf8");
  assert.match(source, /MAX_TIMEOUT_MS = 8000/);
  assert.match(source, /Math\.min\(MAX_TIMEOUT_MS, Math\.max\(1, requestedTimeout\)\)/);
});

// ── 6. Host allowlist fail-closed pra URL do tracker ──────────────────────────────────────

test("validateTrackerUrl aceita só HTTPS, /api/track e host da allowlist", () => {
  const url = validateTrackerUrl(TRACKER_ORIGIN, HOST);
  assert.equal(url.hostname, HOST);
  assert.equal(url.pathname, QUIZ_TRACK_PATH);
});

test("validateTrackerUrl recusa http, porta, credencial, query, hash", () => {
  const recusadas = [
    `http://${HOST}`,
    `https://${HOST}:8443`,
    `https://user:pass@${HOST}`,
    `https://${HOST}?x=1`,
    `https://${HOST}#frag`,
    "não-é-url",
    "",
    null,
  ];
  for (const raw of recusadas) {
    assert.throws(
      () => validateTrackerUrl(raw, HOST),
      (error) => error instanceof TestarTrackerError && error.code === "TRACKER_URL_INVALID",
      `deveria recusar ${String(raw)}`,
    );
  }
});

test("validateTrackerUrl é fail-closed: host fora da allowlist não passa (allowlist vazia recusa tudo)", () => {
  for (const allowlist of ["", null, undefined, "outro-host.example", []]) {
    assert.throws(
      () => validateTrackerUrl(TRACKER_ORIGIN, allowlist),
      (error) => error instanceof TestarTrackerError && error.code === "TRACKER_HOST_NOT_ALLOWLISTED",
    );
  }
});

test("checkTrackerOrigin com config de tracker inválida lança em vez de mentir que testou", async () => {
  await assert.rejects(
    () => checkTrackerOrigin(FUNNEL_ORIGIN, { trackerOrigin: TRACKER_ORIGIN, hostAllowlist: "outro-host.example" }),
    (error) => error instanceof TestarTrackerError && error.code === "TRACKER_HOST_NOT_ALLOWLISTED",
  );
});

// ── 7. normalizeFunnelOrigin — precisa casar com normalizedOrigin() do server real ───────

test("normalizeFunnelOrigin aceita domínio bare https e derruba a barra final", () => {
  assert.equal(normalizeFunnelOrigin("https://roxyfox.online"), "https://roxyfox.online");
  assert.equal(normalizeFunnelOrigin("https://roxyfox.online/"), "https://roxyfox.online");
  assert.equal(normalizeFunnelOrigin("  https://roxyfox.online  "), "https://roxyfox.online");
});

test("normalizeFunnelOrigin recusa http, caminho, query, hash, credencial e lixo", () => {
  for (const raw of [
    "http://roxyfox.online",
    "https://roxyfox.online/presell",
    "https://roxyfox.online?x=1",
    "https://roxyfox.online#a",
    "https://user:pass@roxyfox.online",
    "não é url",
    "",
    "   ",
    null,
    undefined,
  ]) {
    assert.equal(normalizeFunnelOrigin(raw), null, `deveria recusar ${JSON.stringify(raw)}`);
  }
});

// ── 8. Rota: 400 de payload, 400 de domínio inválido ──────────────────────────────────────

test("handleTestarTrackerRequest exige os 4 campos antes de testar", async () => {
  const casos = [
    {},
    { projectId: "v-spot" },
    { projectId: "v-spot", funnelId: "principal" },
    { projectId: "v-spot", funnelId: "principal", pageId: "presell" },
    { projectId: "  ", funnelId: "principal", pageId: "presell", origin: FUNNEL_ORIGIN },
  ];
  for (const payload of casos) {
    const result = await handleTestarTrackerRequest(payload, CONFIG);
    assert.equal(result.status, 400, `deveria recusar ${JSON.stringify(payload)}`);
  }
});

test("handleTestarTrackerRequest recusa domínio de página inválido com 400 explicativo", async () => {
  const result = await handleTestarTrackerRequest(
    { projectId: "v-spot", funnelId: "principal", pageId: "presell", origin: "roxyfox.online/sem-protocolo" },
    CONFIG,
  );
  assert.equal(result.status, 400);
  assert.match(result.body.error, /[Dd]omínio/);
});

// ── 9. route.ts é adaptador fino: só requireAdmin() + delega, sem fetch/db/log próprios ──

test("route.ts é adaptador fino: requireAdmin, delega pro core, sem fetch/db/console próprios", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  assert.match(source, /export async function POST\(request: Request\)/);
  assert.match(source, /import \{ requireAdmin, AdminAuthError \} from "@\/lib\/admin-auth"/);
  assert.match(
    source,
    /import \{ handleTestarTrackerRequest \} from "@\/lib\/sistemas\/quiz\/testar-tracker-core\.mjs"/,
  );
  assert.match(source, /await requireAdmin\(\)/);
  assert.match(source, /NextResponse\.json\(result\.body, \{ status: result\.status \}\)/);
  assert.match(source, /export const runtime = "nodejs"/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /from "@\/db"/);
  assert.doesNotMatch(source, /console\./);
});
