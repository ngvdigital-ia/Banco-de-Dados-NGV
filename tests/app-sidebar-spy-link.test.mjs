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

test("Spy Analytics is opt-in and empty by default", () => {
  assert.match(source, /process\.env\.NEXT_PUBLIC_SPY_ANALYTICS_URL/);
  assert.match(source, /getSafeExternalUrl\(process\.env\.NEXT_PUBLIC_SPY_ANALYTICS_URL\)/);
  assert.match(envExample, /^NEXT_PUBLIC_SPY_ANALYTICS_URL=\s*$/m);
});

test("Spy Analytics accepts only a safe HTTPS URL", () => {
  assert.match(source, /import \{ getSafeExternalUrl \} from "@\/lib\/external-dashboard-url"/);
  assert.match(source, /getSafeExternalUrl\(process\.env\.NEXT_PUBLIC_SPY_ANALYTICS_URL\)/);
});

test("shared URL helper enforces HTTPS without userinfo, query, or hash", async () => {
  const helper = await readFile(
    new URL("../src/lib/external-dashboard-url.ts", import.meta.url),
    "utf8",
  );
  assert.match(helper, /export function getSafeExternalUrl/);
  assert.match(helper, /const trimmedValue = value\?\.trim\(\)/);
  assert.match(helper, /new URL\(trimmedValue\)/);
  assert.match(helper, /url\.protocol !== "https:"/);
  assert.match(helper, /url\.username/);
  assert.match(helper, /url\.password/);
  assert.match(helper, /url\.search/);
  assert.match(helper, /url\.hash/);
  assert.match(helper, /catch \{/);
});

test("Spy Analytics is an explicitly external, inactive link", () => {
  assert.match(source, /ScanSearch/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /aria-label=\{`\$\{item\.title\} \(abre em nova aba\)`\}/);
  assert.match(source, /ExternalLink/);
  assert.match(source, /item\.external\s*\?\s*false/);
  assert.match(source, /h-11[^\"]*md:h-9/);
});

test("Spy Analytics does not embed or fetch dashboard data", () => {
  assert.doesNotMatch(source, /<iframe\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
