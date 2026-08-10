#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_HUB, buildSnapshot, writeSnapshotAtomic } from "./generate-snapshot.mjs";
import { readCanonicalManifests, refreshLiveStatus } from "./refresh-live-status.mjs";

export async function refreshOperation({
  loadManifests = readCanonicalManifests,
  collect = refreshLiveStatus,
  build = buildSnapshot,
  write = writeSnapshotAtomic,
  hub = DEFAULT_HUB,
} = {}) {
  const manifests = await loadManifests();
  await collect(manifests);
  const snapshot = await build(hub);
  await write(snapshot);
  return snapshot;
}

async function main() {
  if (process.argv.length > 2) throw new Error("Argumentos não permitidos: execute sem argumentos.");
  const snapshot = await refreshOperation();
  process.stdout.write(`Operação atualizada: ${snapshot.offers.length} ofertas, ${snapshot.events.length} eventos.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Falha ao atualizar operação: ${error instanceof Error ? error.message : "erro desconhecido"}\n`);
    process.exitCode = 1;
  });
}
