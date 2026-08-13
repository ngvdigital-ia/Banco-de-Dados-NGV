import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/(dashboard)/settings/page.tsx", import.meta.url),
  "utf8",
);

test("settings presents both approved tools as external operational tools", () => {
  assert.match(source, /Ferramentas operacionais/);
  assert.match(source, /title="Spy Analytics"/);
  assert.match(source, /title="Quiz Analytics"/);
  assert.match(source, /Ferramenta externa/);
  assert.match(source, /Disponível para abrir/);
  assert.match(source, /Não configurado/);
});

test("settings only renders an external link for a safe configured URL", () => {
  assert.match(source, /getSafeExternalUrl\(process\.env\.NEXT_PUBLIC_SPY_ANALYTICS_URL\)/);
  assert.match(source, /getSafeExternalUrl\(process\.env\.NEXT_PUBLIC_QUIZ_ANALYTICS_URL\)/);
  assert.match(source, /href=\{url\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /min-h-11/);
  assert.match(source, /\{url \?/);
  assert.match(source, /: \(/);
});

test("settings states that tools are external and does not fetch or embed data", () => {
  assert.match(source, /não sincroniza dados com o NGV/i);
  assert.match(source, /não representa uma integração conectada/i);
  assert.doesNotMatch(source, /<iframe\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
