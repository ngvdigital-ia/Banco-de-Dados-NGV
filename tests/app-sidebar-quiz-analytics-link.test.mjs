import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/app-sidebar.tsx", import.meta.url),
  "utf8",
);
const envExample = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

test("Quiz Analytics is dormant and empty by default", () => {
  assert.match(source, /process\.env\.NEXT_PUBLIC_QUIZ_ANALYTICS_URL/);
  assert.match(source, /title: "Quiz Analytics"/);
  assert.match(envExample, /^NEXT_PUBLIC_QUIZ_ANALYTICS_URL=\s*$/m);
});

test("Quiz reuses the shared safe external URL validation", () => {
  assert.match(
    source,
    /getSafeExternalUrl\(process\.env\.NEXT_PUBLIC_QUIZ_ANALYTICS_URL\)/,
  );
  assert.match(source, /import \{ getSafeExternalUrl \} from "@\/lib\/external-dashboard-url"/);
  assert.doesNotMatch(source, /function getSafeExternalUrl/);
});

test("Quiz and Spy are external, touch-friendly, and inactive", () => {
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /ExternalLink/);
  assert.match(source, /aria-label=\{`\$\{item\.title\} \(abre em nova aba\)`\}/);
  assert.match(source, /item\.external\s*\?\s*false/);
  assert.match(source, /h-11[^\"]*md:h-9/);
  assert.doesNotMatch(source, /<iframe\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_(?:SPY|QUIZ)_ANALYTICS_URL=https?:/);
});
