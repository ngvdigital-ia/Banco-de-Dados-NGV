import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FUNIS_ROUTE_PATH = new URL("../src/app/api/sistemas/quiz/funis/route.ts", import.meta.url);

test("criação V2 é uma rota autenticada, limitada e com contrato multi-página", async () => {
  const route = await readFile(FUNIS_ROUTE_PATH, "utf8");

  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /readBoundedJsonRequest\(request\)/);
  assert.match(route, /format: z\.enum\(\["quiz", "presell"\]\)/);
  assert.match(route, /pages: z\.array\(pageSchema\)\.min\(2\)\.max\(100\)/);
  assert.match(route, /method: "POST", payload: parsed\.data/);
  assert.match(route, /url\.protocol === "https:"/);
  assert.match(route, /!url\.username && !url\.password && !url\.hash/);
  assert.match(route, /PAYLOAD_TOO_LARGE/);
  assert.doesNotMatch(route, /offerTracking|bancoOfferTrackingId|finalUrl/);
});
