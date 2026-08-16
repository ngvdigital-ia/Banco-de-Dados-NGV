// Reexporta os tipos declarados em estado-client.d.mts (sibling do adapter .mjs) — contrato vive
// num único lugar, este arquivo só aponta pra ele.
export type {
  SpyModuleEstadoData,
  SpyModuleEstadoResult,
  SpyLeitura,
  SpyOferta,
  SpyPesos,
} from "@/lib/sistemas/spy/estado-client.mjs";
