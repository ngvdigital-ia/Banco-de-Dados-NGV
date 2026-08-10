import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { compareBlockerRows } from "../src/lib/operacao/blocker-order.mjs";
import { expectedSnapshotForCheck, mergeLiveEvidence, normalizeSnapshotForCheck, projectLiveArtifact, projectManifest, writeSnapshotAtomic } from "../src/lib/operacao/generate-snapshot.mjs";
import { refreshOperation } from "../src/lib/operacao/refresh-operation.mjs";
import { captureReadOnlySnapshot, phaseForOffer, projectRecentOffers, RECENT_OFFERS_LIMIT, ROLLING_WINDOW_DAYS, stateForPhase } from "../src/lib/operacao/recent-offers.mjs";

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(ROOT, "src", "lib", "operacao", "operation.snapshot.json");
const GENERATOR_PATH = path.join(ROOT, "src", "lib", "operacao", "generate-snapshot.mjs");
const PAGE_PATH = path.join(ROOT, "src", "app", "(dashboard)", "operacao", "page.tsx");
const ROOT_PAGE_PATH = path.join(ROOT, "src", "app", "(dashboard)", "page.tsx");
const DASHBOARD_PAGE_PATH = path.join(ROOT, "src", "app", "(dashboard)", "dashboard", "page.tsx");
const FEATURE_PATH = path.join(ROOT, "src", "lib", "operacao", "feature.ts");
const SIDEBAR_PATH = path.join(ROOT, "src", "components", "app-sidebar.tsx");
const COMMAND_PALETTE_PATH = path.join(ROOT, "src", "components", "command-palette.tsx");
const BREADCRUMB_PATH = path.join(ROOT, "src", "components", "breadcrumb-nav.tsx");
const VIEW_PATH = path.join(ROOT, "src", "components", "operacao", "operation-view.tsx");
const ERROR_PATH = path.join(ROOT, "src", "app", "(dashboard)", "operacao", "error.tsx");
const OFFER_ID = /^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_KEY = /^(?:email|e-mail|token|secret|password|cookie|authorization|api[_-]?key|access[_-]?key|private[_-]?key)$/i;
const SENSITIVE_VALUE = /(?:xox[baprs]-|ghp_|glpat-|bearer\s+|@[a-z0-9.-]+\.[a-z]{2,}|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-])\d{4,5}[\s.-]\d{4}\b|[A-Za-z]:\\|file:\/\/\/(?:[A-Za-z0-9._-]+\/?)+|(?:^|[\s"'=(])\/(?:[A-Za-z0-9._-]+\/?)+|\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:sk|pk)_[A-Za-z0-9_-]+\b|\bsk-proj-[A-Za-z0-9_-]+\b|\bpk-[A-Za-z0-9_-]+\b)/i;

async function snapshot() {
  return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
}

function walk(value, visit, trail = "root") {
  visit(value, trail);
  if (Array.isArray(value)) value.forEach((child, index) => walk(child, visit, `${trail}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => walk(child, visit, `${trail}.${key}`));
}

test("snapshot declara origem e modo read-only", async () => {
  const data = await snapshot();
  assert.equal(data.schema_version, 1);
  assert.equal(data.mode, "read-only");
  assert.equal(data.source, "ngv-hub-local-projection");
  assert.ok(!Number.isNaN(Date.parse(data.generated_at)));
  assert.deepEqual(data.phases.map((item) => item.phase), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("ofertas e ambiguidades permanecem conservadoras", async () => {
  const data = await snapshot();
  assert.ok(data.offers.length > 0);
  for (const offer of data.offers) {
    assert.match(offer.offer_id, OFFER_ID);
    assert.ok(Number.isInteger(offer.phase) && offer.phase >= 0 && offer.phase <= 7);
    assert.ok(["PENDING", "BLOCKED", "IN_MOTION", "READY_FOR_REVIEW"].includes(offer.state));
    assert.ok(Array.isArray(offer.blockers));
    for (const blocker of offer.blockers) {
      assert.ok(["BLOCKED", "ATTENTION", "PENDING"].includes(blocker.severity));
      assert.ok(blocker.occurred_at === null || !Number.isNaN(Date.parse(blocker.occurred_at)));
    }
  }
  const ambiguous = data.offers.filter((offer) => offer.offer_id.startsWith("ngv:ambiguous-"));
  assert.ok(ambiguous.length >= 1);
  assert.ok(ambiguous.every((offer) => offer.state === "BLOCKED" && offer.blockers.some((item) => item.code === "IDENTITY_AMBIGUOUS")));
});

test("pendências de configuração não são projetadas como bloqueios confirmados", async () => {
  const data = await snapshot();
  const manifestPending = data.offers.flatMap((offer) => offer.blockers.map((blocker) => ({ offer, blocker })))
    .filter(({ blocker }) => blocker.code === "MANIFEST_PENDING");

  assert.ok(manifestPending.length > 0);
  assert.ok(manifestPending.every(({ blocker }) => blocker.severity === "PENDING"));
  const pendingOnlyOffers = data.offers.filter((offer) => offer.blockers.length > 0
    && offer.blockers.every((blocker) => blocker.severity === "PENDING"));
  assert.ok(pendingOnlyOffers.length > 0);
  assert.ok(pendingOnlyOffers.every((offer) => offer.state !== "BLOCKED"));
  assert.equal(data.phases.find((item) => item.phase === 0)?.label, "Sem etapa comprovada");
});

test("evento bloqueado no ledger prevalece sobre pendências do manifesto", () => {
  const offer = projectManifest({
    offer_id: "ngv:oferta-de-teste",
    offer_slug: "oferta-de-teste",
    identity: { display_name: "Oferta de teste", language: "pt" },
    blockers: ["Confirmar configuração antes de ativar."],
    last_verified: "2026-08-10T10:00:00.000Z",
  }, {
    phase: 2,
    event_type: "blocked",
    state: "BLOCKED",
    blocker_code: "TRACKING_MISSING",
    source: "ledger",
    occurred_at: "2026-08-10T12:00:00.000Z",
  });

  assert.equal(offer.state, "BLOCKED");
  assert.equal(offer.blockers[0].code, "TRACKING_MISSING");
  assert.equal(offer.blockers[0].severity, "BLOCKED");
  assert.equal(offer.blockers[1].severity, "PENDING");
});

test("fontes expõem última leitura real ou PENDING explícito", async () => {
  const data = await snapshot();
  assert.ok(data.sources.length > 0);
  for (const source of data.sources) {
    assert.ok(Object.hasOwn(source, "last_read_at"));
    assert.ok(source.last_read_at === null || !Number.isNaN(Date.parse(source.last_read_at)));
    if (source.state === "OPERANT") assert.notEqual(source.last_read_at, null);
  }
  assert.ok(data.sources.some((source) => source.last_read_at === null));
});

test("bloqueios são ordenados por severidade, antiguidade e nome", () => {
  const at = (display_name, severity, occurred_at, code) => ({
    offer: { display_name },
    blocker: { severity, occurred_at, code },
  });
  const rows = [
    at("Zulu", "PENDING", "2026-01-01T00:00:00.000Z", "P"),
    at("Bravo", "BLOCKED", "2026-02-01T00:00:00.000Z", "B2"),
    at("Alpha", "ATTENTION", "2025-01-01T00:00:00.000Z", "A"),
    at("Charlie", "BLOCKED", "2026-01-01T00:00:00.000Z", "B1"),
    at("Alpha", "BLOCKED", null, "BN"),
  ].sort(compareBlockerRows);
  assert.deepEqual(rows.map((row) => row.blocker.code), ["B1", "B2", "BN", "A", "P"]);
});

test("snapshot versionado não contém PII, segredo ou path local", async () => {
  const data = await snapshot();
  walk(data, (value, trail) => {
    const key = trail.split(".").at(-1)?.replace(/\[\d+\]$/, "") ?? "";
    assert.equal(FORBIDDEN_KEY.test(key), false, `chave sensível em ${trail}`);
    if (typeof value === "string") assert.equal(SENSITIVE_VALUE.test(value), false, `valor sensível em ${trail}`);
  });
});

test("página não usa fetch externo, env ou Server Action", async () => {
  const sources = `${await readFile(PAGE_PATH, "utf8")}\n${await readFile(VIEW_PATH, "utf8")}`;
  assert.equal(/\bfetch\s*\(/.test(sources), false);
  assert.equal(/process\.env/.test(sources), false);
  assert.equal(/["']use server["']/.test(sources), false);
  assert.match(sources, /Somente leitura/);
});

test("cockpit de operação só habilita com a flag literal true", async () => {
  const feature = await readFile(FEATURE_PATH, "utf8");
  assert.match(
    feature,
    /export const isOperationCockpitEnabled\s*=\s*process\.env\.NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED\s*===\s*["']true["'];/
  );
});

test("raiz alterna entre operação e dashboard pela flag", async () => {
  const rootPage = await readFile(ROOT_PAGE_PATH, "utf8");
  assert.match(rootPage, /import \{ isOperationCockpitEnabled \} from ["']@\/lib\/operacao\/feature["'];/);
  assert.match(
    rootPage,
    /redirect\(isOperationCockpitEnabled\s*\?\s*["']\/operacao["']\s*:\s*["']\/dashboard["']\)/
  );
});

test("operação retorna ao dashboard com flag desabilitada antes de consultar o Banco", async () => {
  const operationPage = await readFile(PAGE_PATH, "utf8");
  const disabledRedirect = operationPage.indexOf('if (!isOperationCockpitEnabled) {\n    redirect("/dashboard");\n  }');
  const snapshotRead = operationPage.indexOf("const result = await readOperationSnapshot()");

  assert.match(operationPage, /import \{ isOperationCockpitEnabled \} from ["']@\/lib\/operacao\/feature["'];/);
  assert.ok(disabledRedirect >= 0, "redirect para /dashboard com flag desabilitada ausente");
  assert.ok(snapshotRead >= 0, "consulta read-only do Banco ausente");
  assert.ok(disabledRedirect < snapshotRead, "redirect deve ocorrer antes da consulta do Banco");
  assert.match(operationPage, /affectedSources=\{\["Banco NGV"\]\}/);
  assert.doesNotMatch(operationPage, /operation\.snapshot/);
});

test("falha da consulta não devolve snapshot histórico", async () => {
  const failure = new Error("Banco indisponível");
  const result = await captureReadOnlySnapshot(async () => { throw failure; });

  assert.equal(result.snapshot, null);
  assert.equal(result.error, failure);
  assert.equal(Object.hasOwn(result, "fallback"), false);
});

test("projeção recente usa ID real e o marco mais avançado comprovado", () => {
  const base = {
    id: 257,
    name: "Oferta recente",
    language: "PT",
    createdAt: new Date("2026-08-10T10:00:00.000Z"),
    updatedAt: new Date("2026-08-10T12:00:00.000Z"),
    copyVslStatus: "NAO",
    copyCriativosStatus: "SIM",
    vslInVturb: "NAO",
    siteCreated: "SIM",
    productCreated: "SIM",
    productApproved: "NAO",
    campaignsActive: "NAO",
    validation: "EM ANDAMENTO",
  };
  const data = projectRecentOffers([base], new Date("2026-08-10T15:00:00.000Z"));
  const projected = data.offers[0];

  assert.equal(projected.offer_id, "banco:257");
  assert.equal(projected.offer_slug, "banco-257");
  assert.equal(projected.phase, 5);
  assert.equal(projected.state, "IN_MOTION");
  assert.deepEqual(projected.blockers, []);
  assert.deepEqual(data.events, []);
  assert.equal(data.source, "banco-ngv-runtime");

  assert.equal(phaseForOffer({ ...base, campaignsActive: "SIM" }), 6);
  assert.equal(phaseForOffer({ ...base, validation: "NÃO DEU CERTO" }), 7);
  assert.equal(stateForPhase(7), "READY_FOR_REVIEW");
});

test("consulta recente mantém janela móvel e limite defensivo", async () => {
  const snapshotSource = await readFile(path.join(ROOT, "src", "lib", "operacao", "snapshot.ts"), "utf8");

  assert.equal(ROLLING_WINDOW_DAYS, 30);
  assert.equal(RECENT_OFFERS_LIMIT, 200);
  assert.match(snapshotSource, /gte\(offerTracking\.createdAt, recentOffersCutoff\(now\)\)/);
  assert.match(snapshotSource, /orderBy\(desc\(offerTracking\.createdAt\)\)/);
  assert.match(snapshotSource, /limit\(RECENT_OFFERS_LIMIT\)/);
});

test("dashboard preservado continua acessível em rota própria", async () => {
  const dashboardPage = await readFile(DASHBOARD_PAGE_PATH, "utf8");

  assert.match(dashboardPage, /from ["']@\/app\/\(dashboard\)\/dashboard-actions["']/);
  assert.match(dashboardPage, /export default async function DashboardPage\(\)/);
  assert.match(dashboardPage, /Visão Geral/);
  assert.match(dashboardPage, /Performance de Vídeo/);
  assert.match(dashboardPage, /Projetos &amp; Métricas/);
  assert.doesNotMatch(dashboardPage, /isOperationCockpitEnabled/);
});

test("sidebar e command palette preservam Dashboard e condicionam Operação à flag", async () => {
  const [sidebar, commandPalette, breadcrumb] = await Promise.all([
    readFile(SIDEBAR_PATH, "utf8"),
    readFile(COMMAND_PALETTE_PATH, "utf8"),
    readFile(BREADCRUMB_PATH, "utf8"),
  ]);
  assert.match(sidebar, /import \{ isOperationCockpitEnabled \} from ["']@\/lib\/operacao\/feature["'];/);
  assert.match(sidebar, /\{ title: ["']Dashboard["'], href: ["']\/dashboard["']/);
  assert.match(sidebar, /\.\.\.\(isOperationCockpitEnabled \? \[\{ title: ["']Operação["'], href: ["']\/operacao["']/);
  assert.match(commandPalette, /import \{ isOperationCockpitEnabled \} from ["']@\/lib\/operacao\/feature["'];/);
  assert.match(commandPalette, /\{ label: ["']Dashboard["'], href: ["']\/dashboard["'] \}/);
  assert.match(commandPalette, /\.\.\.\(isOperationCockpitEnabled \? \[\{ label: ["']Operação["'], href: ["']\/operacao["'] \}/);
  assert.match(breadcrumb, /operacao: ["']Operação["']/);
});

test("UI de operação preserva reflow mobile, IDs e alvos de 44px", async () => {
  const sources = `${await readFile(VIEW_PATH, "utf8")}\n${await readFile(ERROR_PATH, "utf8")}`;
  assert.match(sources, /aria-label="Saúde das fontes"/);
  assert.match(sources, /md:hidden/);
  assert.match(sources, /hidden md:block/);
  assert.equal(sources.includes("min-w-[520px]"), false);
  assert.match(sources, /event\.event_id/);
  assert.match(sources, /select-all/);
  assert.match(sources, /size-11/);
  assert.match(sources, /focus-visible:ring-offset-2/);
  assert.match(sources, /Fontes afetadas conhecidas/);
  assert.match(sources, /PENDING/);
  assert.match(sources, /Aguardando configuração/);
  assert.match(sources, /blocker\.severity === "BLOCKED"/);
  assert.match(sources, /Últimos 30 dias/);
  assert.match(sources, /Produção · fases 1–4/);
  assert.match(sources, /Consulta read-only · Banco NGV · janela móvel de 30 dias/);
});

test("gerador valida o snapshot no hub canônico padrão", () => {
  const result = spawnSync(process.execPath, [GENERATOR_PATH, "--check"], { cwd: ROOT, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS snapshot:/);
});

test("gerador recusa hub fora da allowlist antes de ler dados", () => {
  const result = spawnSync(process.execPath, [GENERATOR_PATH, "--hub", ROOT, "--check"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fora da allowlist/);
});

test("evidência live stale degrada fonte sem alterar lifecycle da oferta", () => {
  const offer = { offer_id: "ngv:calistenia-21d", phase: 0, state: "BLOCKED" };
  const snapshotData = {
    offers: [offer],
    sources: [{ id: "clickup", label: "ClickUp", state: "UNVERIFIED", coverage: "3/3", detail: "local", last_read_at: null }],
    events: [],
  };
  const merged = mergeLiveEvidence(snapshotData, {
    generated_at: "2026-08-09T23:59:59.000Z",
    sources: new Map([["clickup", { id: "clickup", label: "ClickUp", state: "OPERANT", coverage: "3/3", detail: "ok", last_read_at: "2026-08-09T23:59:59.000Z" }]]),
    events: [{ event_id: "n8n:execution-17:86ajm207a", offer_id: offer.offer_id, phase: 7, event_type: "n8n_execution_observed", occurred_at: "2026-08-10T00:00:00.000Z", source: "n8n", state: "success", blocker_code: null }],
  }, Date.parse("2026-08-10T12:00:00.000Z"));

  assert.equal(merged.sources[0].state, "DEGRADED");
  assert.deepEqual(merged.offers, [offer]);
  assert.equal(merged.events[0].phase, 1);
});

test("projeção live exige leitura para fonte operante e ignora oferta desconhecida", () => {
  const artifact = {
    schema_version: 1,
    mode: "read-only",
    generated_at: "2026-08-10T12:00:00.000Z",
    sources: [{ id: "clickup", state: "OPERANT", coverage: "1/1", detail: "ok", last_read_at: null }],
    events: [],
  };
  assert.throws(() => projectLiveArtifact(artifact, new Set(["ngv:calistenia-21d"])), /exige last_read_at/);

  artifact.sources[0].last_read_at = "2026-08-10T12:00:00.000Z";
  artifact.events = [{ event_id: "clickup:x:1", offer_id: "ngv:outra-oferta", phase: 1, event_type: "observed", occurred_at: "2026-08-10T12:00:00.000Z", source: "clickup", state: "ok", blocker_code: null }];
  assert.deepEqual(projectLiveArtifact(artifact, new Set(["ngv:calistenia-21d"])).events, []);
});

test("check limpo desconta somente o overlay live persistido conhecido", () => {
  const expected = {
    schema_version: 1,
    generated_at: "2026-08-10T13:00:00.000Z",
    offers: [{ offer_id: "ngv:calistenia-21d" }],
    sources: [
      { id: "registry", label: "Registry", state: "OPERANT", coverage: "1/1", detail: "local", last_read_at: "2026-08-10T13:00:00.000Z" },
      { id: "clickup", label: "ClickUp", state: "UNVERIFIED", coverage: "1/1", detail: "sem rede", last_read_at: null },
      { id: "n8n", label: "n8n", state: "UNVERIFIED", coverage: "PENDING", detail: "sem rede", last_read_at: null },
    ],
    events: [{ event_id: "ledger:1", offer_id: "ngv:calistenia-21d", phase: 1, source: "registry", event_type: "created", occurred_at: "2026-08-10T11:00:00.000Z", state: "ok", blocker_code: null }],
  };
  const committed = structuredClone(expected);
  committed.generated_at = "2026-08-10T12:00:00.000Z";
  committed.sources[0].last_read_at = committed.generated_at;
  committed.sources[1] = { ...committed.sources[1], state: "OPERANT", coverage: "1/1", detail: "consulta concluída", last_read_at: committed.generated_at };
  committed.sources[2] = { ...committed.sources[2], state: "OPERANT", coverage: "7 execuções", detail: "consulta concluída", last_read_at: committed.generated_at };
  committed.events.push(
    { event_id: "clickup:1", offer_id: "ngv:calistenia-21d", phase: 1, source: "clickup", event_type: "clickup_task_observed", occurred_at: committed.generated_at, state: "ok", blocker_code: null },
    { event_id: "n8n:1", offer_id: "ngv:calistenia-21d", phase: 1, source: "n8n", event_type: "n8n_execution_observed", occurred_at: committed.generated_at, state: "ok", blocker_code: null },
  );
  committed.events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  const normalized = normalizeSnapshotForCheck(committed, expected);
  const comparableExpected = expectedSnapshotForCheck(committed, expected, { liveInputPresent: false });
  assert.deepEqual(normalized, comparableExpected);
});

test("check limpo não oculta mutações fora do overlay live conhecido", () => {
  const expected = {
    generated_at: "2026-08-10T13:00:00.000Z",
    offers: [{ offer_id: "ngv:calistenia-21d" }],
    sources: [{ id: "clickup", label: "ClickUp", state: "UNVERIFIED", coverage: "1/1", detail: "sem rede", last_read_at: null }],
    events: [],
  };
  const committed = structuredClone(expected);
  committed.sources[0].label = "Fonte adulterada";
  committed.events.push({ event_id: "clickup:unknown", source: "clickup", event_type: "evento_desconhecido" });

  assert.throws(
    () => expectedSnapshotForCheck(committed, expected, { liveInputPresent: false }),
    /Fonte live persistida clickup inválida/,
  );
});

test("check limpo recompõe eventos locais deslocados pelo limite de 100", () => {
  const eventAt = (index) => ({
    event_id: `ledger:${index}`,
    offer_id: "ngv:calistenia-21d",
    phase: 1,
    event_type: "local_observed",
    occurred_at: new Date(Date.UTC(2026, 7, 10, 0, 0, index)).toISOString(),
    source: "ledger",
    state: "ok",
    blocker_code: null,
  });
  const expected = {
    generated_at: "2026-08-10T13:00:00.000Z",
    offers: [{ offer_id: "ngv:calistenia-21d" }],
    sources: [],
    events: Array.from({ length: 100 }, (_, index) => eventAt(index)).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
  };
  const liveEvent = {
    event_id: "clickup:latest",
    offer_id: "ngv:calistenia-21d",
    phase: 1,
    event_type: "clickup_task_observed",
    occurred_at: "2026-08-10T14:00:00.000Z",
    source: "clickup",
    state: "ok",
    blocker_code: null,
  };
  const committed = structuredClone(expected);
  committed.events = [liveEvent, ...committed.events].slice(0, 100);

  assert.deepEqual(
    normalizeSnapshotForCheck(committed, expected),
    expectedSnapshotForCheck(committed, expected, { liveInputPresent: false }),
  );
});

test("check com artefato live mantém comparação estrita", () => {
  const expected = {
    generated_at: "2026-08-10T13:00:00.000Z",
    offers: [{ offer_id: "ngv:calistenia-21d" }],
    sources: [],
    events: [],
  };
  const committed = structuredClone(expected);
  committed.events.push({
    event_id: "clickup:unexpected",
    offer_id: "ngv:calistenia-21d",
    phase: 1,
    event_type: "clickup_task_observed",
    occurred_at: "2026-08-10T14:00:00.000Z",
    source: "clickup",
    state: "ok",
    blocker_code: null,
  });

  assert.notDeepEqual(
    normalizeSnapshotForCheck(committed, expected),
    expectedSnapshotForCheck(committed, expected, { liveInputPresent: true }),
  );
});

test("recusa operation.live adulterado e preserva URLs legítimas", () => {
  const artifact = {
    schema_version: 1,
    mode: "read-only",
    generated_at: "2026-08-10T12:00:00.000Z",
    sources: [{ id: "clickup", state: "UNAVAILABLE", coverage: "0/1", detail: "https://docs.example.test/live", last_read_at: null }],
    events: [],
  };
  assert.doesNotThrow(() => projectLiveArtifact(artifact, new Set(["ngv:calistenia-21d"])));

  const secretLikeValues = [
    ["sk", "private_value"].join("_"),
    ["sk", "proj-private_value"].join("-"),
  ];
  for (const value of [...secretLikeValues, "pk-live-private_value", "file:///home/operator/private", "(/home/operator/private)"]) {
    artifact.events = [{ event_id: "clickup:pilot:1", offer_id: "ngv:calistenia-21d", phase: 1, event_type: "observed", occurred_at: "2026-08-10T12:00:00.000Z", source: "clickup", state: value, blocker_code: null }];
    assert.throws(() => projectLiveArtifact(artifact, new Set(["ngv:calistenia-21d"])), /conteúdo sensível/);
  }
});

test("escrita atômica recusa snapshot sensível antes de escrever", async () => {
  await assert.rejects(writeSnapshotAtomic({ status: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature" }), /conteúdo sensível/);
});

test("runner coleta antes de gerar, persiste o merge e não avança lifecycle", async () => {
  const order = [];
  const offer = { offer_id: "ngv:calistenia-21d", phase: 0, state: "BLOCKED" };
  let liveArtifact;
  let written;
  const result = await refreshOperation({
    loadManifests: async () => { order.push("load"); return [{ offer_id: offer.offer_id }]; },
    collect: async () => {
      order.push("collect");
      liveArtifact = {
        generated_at: "2026-08-10T12:00:00.000Z",
        sources: new Map([["clickup", { id: "clickup", label: "ClickUp", state: "OPERANT", coverage: "1/1", detail: "ok", last_read_at: "2026-08-10T12:00:00.000Z" }]]),
        events: [{ event_id: "clickup:pilot:1", offer_id: offer.offer_id, phase: 1, event_type: "clickup_task_observed", occurred_at: "2026-08-10T12:00:00.000Z", source: "clickup", state: "ok", blocker_code: null }],
      };
    },
    build: async () => {
      order.push("build");
      return mergeLiveEvidence({ offers: [offer], sources: [{ id: "clickup", label: "ClickUp", state: "UNVERIFIED", coverage: "1/1", detail: "local", last_read_at: null }], events: [] }, liveArtifact, Date.parse("2026-08-10T12:01:00.000Z"));
    },
    write: async (snapshotData) => { order.push("write"); written = snapshotData; },
  });

  assert.deepEqual(order, ["load", "collect", "build", "write"]);
  assert.equal(result.events[0].source, "clickup");
  assert.equal(written.offers[0].phase, 0);
  assert.equal(written.offers[0].state, "BLOCKED");
});

test("runner não gera snapshot quando a coleta falha", async () => {
  const order = [];
  await assert.rejects(refreshOperation({
    loadManifests: async () => [],
    collect: async () => { order.push("collect"); throw new Error("coleta falhou"); },
    build: async () => { order.push("build"); },
    write: async () => { order.push("write"); },
  }), /coleta falhou/);
  assert.deepEqual(order, ["collect"]);
});
