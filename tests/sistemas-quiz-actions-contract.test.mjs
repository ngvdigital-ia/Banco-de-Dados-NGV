import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const FUNIS_ROUTE_PATH = new URL("../src/app/api/sistemas/quiz/funis/route.ts", import.meta.url);
const execFileAsync = promisify(execFile);

test("criação V2 é uma rota autenticada, limitada e com contrato multi-página sem IDs técnicos", async () => {
  const route = await readFile(FUNIS_ROUTE_PATH, "utf8");
  const postRoute = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PATCH"));

  assert.match(postRoute, /const unauthorized = await authorize\(\)/);
  assert.match(postRoute, /readBoundedJsonRequest\(request\)/);
  assert.match(route, /format: z\.enum\(\["quiz", "presell"\]\)/);
  assert.match(route, /pages: z\.array\(pageSchema\)\.min\(2\)\.max\(100\)/);
  assert.match(postRoute, /method: "POST", payload: parsed\.data/);
  assert.match(postRoute, /PAYLOAD_TOO_LARGE/);
  assert.doesNotMatch(postRoute, /offerTracking|bancoOfferTrackingId|finalUrl|projectId/);
  assert.match(route, /url\.protocol === "https:"/);
  assert.match(route, /!url\.username && !url\.password && !url\.hash/);
});

test("confirmação PATCH exige admin, limita JSON e delega somente projectId/finalUrl ao proxy", async () => {
  const route = await readFile(FUNIS_ROUTE_PATH, "utf8");
  const patchRoute = route.slice(route.indexOf("export async function PATCH"));

  assert.match(patchRoute, /const unauthorized = await authorize\(\)/);
  assert.match(patchRoute, /readBoundedJsonRequest\(request\)/);
  assert.match(route, /const deploymentSchema = z[\s\S]*projectId: projectIdSchema,[\s\S]*finalUrl: pageSchema\.shape\.url,/);
  assert.match(patchRoute, /deploymentSchema\.safeParse\(body\.value\)/);
  assert.match(patchRoute, /PAYLOAD_TOO_LARGE/);
  assert.match(patchRoute, /method: "PATCH", payload: parsed\.data/);
  assert.match(route, /UPSTREAM_CONFLICT: 409/);
  assert.match(route, /A confirmação não corresponde ao funil aguardando publicação/);
});

test("conflito upstream explica criação sem confundir com confirmação", async () => {
  const route = await readFile(FUNIS_ROUTE_PATH, "utf8");
  const patchRoute = route.slice(route.indexOf("export async function PATCH"));
  const script = `
    import { upstreamErrorMessageFor } from ${JSON.stringify(FUNIS_ROUTE_PATH.pathname)};
    console.log(JSON.stringify({
      post: upstreamErrorMessageFor("UPSTREAM_CONFLICT", "POST"),
      patch: upstreamErrorMessageFor("UPSTREAM_CONFLICT", "PATCH"),
    }));
  `;
  const { stdout } = await execFileAsync("./node_modules/.bin/tsx", ["-e", script], { cwd: process.cwd() });
  const result = JSON.parse(stdout);

  assert.match(route, /export function upstreamErrorMessageFor/);
  assert.match(result.post, /Já existe um funil com esse nome ou com uma dessas páginas/);
  assert.doesNotMatch(result.post, /confirmação/i);
  assert.match(result.patch, /A confirmação não corresponde ao funil aguardando publicação/);
  assert.match(patchRoute, /errorFor\(result\.code, "PATCH"\)/);
});
