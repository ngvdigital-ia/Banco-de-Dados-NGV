// Flag deliberately independent from SISTEMAS_SPY_MODULE_ENABLED: enabling the
// dashboard read path must never authorize writes to the external Spy system.
// This module is only consumed by mutations.ts, which imports "server-only".
export const SPY_MUTATIONS_ENABLED_ENV = "SISTEMAS_SPY_MUTATIONS_ENABLED";

export function isSpyMutationsEnabled(env = process.env) {
  return env?.[SPY_MUTATIONS_ENABLED_ENV] === "true";
}

export function requireSpyMutationsEnabled(env = process.env) {
  if (!isSpyMutationsEnabled(env)) {
    throw new Error(
      "Mutações do Spy estão desabilitadas: defina SISTEMAS_SPY_MUTATIONS_ENABLED=true somente após o canário de escrita.",
    );
  }
}
