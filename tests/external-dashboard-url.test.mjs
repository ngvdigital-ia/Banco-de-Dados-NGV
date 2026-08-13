import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperSource = await readFile(
  new URL("../src/lib/external-dashboard-url.ts", import.meta.url),
  "utf8",
);
const executableHelperSource = helperSource
  .replace("export function", "function")
  .replace("value: string | undefined", "value")
  .replace("): string | null", ")");
const getSafeExternalUrl = new Function(
  `${executableHelperSource}; return getSafeExternalUrl;`,
)();

test("accepts HTTPS URLs with paths and preserves encoded separators", () => {
  assert.equal(
    getSafeExternalUrl(" https://example.com/dashboard/path "),
    "https://example.com/dashboard/path",
  );
  assert.equal(
    getSafeExternalUrl("https://example.com/path%3Fvalue%23hash"),
    "https://example.com/path%3Fvalue%23hash",
  );
});

test("rejects empty, non-HTTPS, userinfo, query, and hash inputs", () => {
  for (const value of [
    undefined,
    "",
    "   ",
    "http://example.com",
    "https://user@example.com",
    "https://user:password@example.com",
    "https://example.com?",
    "https://example.com?source=dashboard",
    "https://example.com#",
    "https://example.com#section",
  ]) {
    assert.equal(getSafeExternalUrl(value), null, value ?? "undefined");
  }
});

test("rejects malformed and whitespace-host URLs", () => {
  for (const value of [
    "https://example .com",
    "https:// example.com",
    "https://",
    "not a URL",
  ]) {
    assert.equal(getSafeExternalUrl(value), null, value);
  }
});
