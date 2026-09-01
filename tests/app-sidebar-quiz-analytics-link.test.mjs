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

test("Funnel Analytics is an internal, touch-friendly system route", () => {
  assert.match(source, /title: "Funnel Analytics", href: "\/sistemas\/quiz", icon: BarChart3/);
  assert.match(envExample, /^NEXT_PUBLIC_QUIZ_ANALYTICS_URL=\s*$/m);
  assert.match(source, /h-11[^\"]*md:h-9/);
  assert.doesNotMatch(source, /title: "Quiz Analytics"/);
});
