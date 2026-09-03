import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/app-sidebar.tsx", import.meta.url),
  "utf8",
);
test("Spy Analytics is an internal route and has no external URL configuration", () => {
  assert.match(source, /\{ title: "Spy Analytics", href: "\/sistemas\/spy", icon: ScanSearch \}/);
  assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_SPY_ANALYTICS_URL/);
  assert.doesNotMatch(source, /getSafeExternalUrl/);
});

test("Spy Analytics uses the internal system route", () => {
  assert.match(source, /title: "Spy Analytics", href: "\/sistemas\/spy"/);
  assert.doesNotMatch(source, /target="_blank"/);
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

test("Spy Analytics is an internal, same-tab link", () => {
  assert.match(source, /ScanSearch/);
  assert.match(source, /href: "\/sistemas\/spy"/);
  assert.doesNotMatch(source, /ExternalLink/);
  assert.doesNotMatch(source, /rel="noopener noreferrer"/);
  assert.match(source, /h-11[^\"]*md:h-9/);
});

test("Spy Analytics does not embed or fetch dashboard data", () => {
  assert.doesNotMatch(source, /<iframe\b/i);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});
