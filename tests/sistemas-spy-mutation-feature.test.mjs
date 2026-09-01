import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SPY_MUTATIONS_ENABLED_ENV,
  isSpyMutationsEnabled,
  requireSpyMutationsEnabled,
} from "../src/lib/sistemas/spy/mutation-feature.mjs";

const MUTATIONS_PATH = new URL("../src/lib/sistemas/spy/mutations.ts", import.meta.url);

test("mutações do Spy ficam desligadas por omissão e só aceitam true literal", () => {
  assert.equal(SPY_MUTATIONS_ENABLED_ENV, "SISTEMAS_SPY_MUTATIONS_ENABLED");
  assert.equal(isSpyMutationsEnabled({}), false);
  assert.equal(isSpyMutationsEnabled({ [SPY_MUTATIONS_ENABLED_ENV]: "false" }), false);
  assert.equal(isSpyMutationsEnabled({ [SPY_MUTATIONS_ENABLED_ENV]: "TRUE" }), false);
  assert.equal(isSpyMutationsEnabled({ [SPY_MUTATIONS_ENABLED_ENV]: "true" }), true);
  assert.throws(() => requireSpyMutationsEnabled({}), /SISTEMAS_SPY_MUTATIONS_ENABLED=true/);
});

test("as sete mutações server-only injetam o gate de flag antes do dispatcher", async () => {
  const source = await readFile(MUTATIONS_PATH, "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /requireSpyMutationsEnabled/);
  assert.equal(
    (source.match(/requireMutationEnabledImpl,/g) ?? []).length,
    7,
    "cada ação mutável deve passar pelo gate independente da leitura",
  );
  assert.doesNotMatch(source, /NEXT_PUBLIC_SISTEMAS_SPY_MUTATIONS_ENABLED/);
});
