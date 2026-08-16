// Declaração de tipos pro adapter .mjs (mesma convenção .d.mts ao lado de .mjs que o TS resolve
// sob "moduleResolution": "bundler" — ver src/lib/sistemas/quiz/analytics-client.d.mts, mesmo
// motivo: sem isso o TS larga `kind` pra `string` (widened), quebrando a união discriminada que
// os componentes de src/components/sistemas/spy/ dependem pra estreitar o tipo).

export declare const SPY_LOGIN_PATH: "/api/auth";
export declare const SPY_ESTADO_PATH: "/api/estado";

export declare class SpyModuleEstadoError extends Error {
  code: string;
  constructor(code: string);
}

export interface SpyOferta {
  id: string;
  nome: string;
  formato: string | null;
  nicho: string | null;
  idioma: string | null;
  link: string | null;
  cloaker: string | null;
  tipoProduto: string | null;
}

export interface SpyLeitura {
  id: string;
  ofertaId: string;
  data: string;
  periodo: "manha" | "noite";
  ads: number;
}

export interface SpyPesos {
  estab: number;
  vol: number;
  tempo: number;
}

export interface SpyModuleEstadoData {
  ofertas: SpyOferta[];
  leituras: SpyLeitura[];
  pesos: SpyPesos;
  tolerancia: number;
  prontasParaModelar: string[];
}

export type SpyModuleEstadoResult =
  | { kind: "not_configured"; reason: string; fetchedAt: null; data: null }
  | { kind: "error"; code: string; fetchedAt: null; data: null }
  | { kind: "success"; fetchedAt: string; data: SpyModuleEstadoData };

export declare function parseSpyModuleEstadoPayload(body: unknown): SpyModuleEstadoData;

export declare function fetchSpyModuleEstado(options?: {
  origin?: string;
  password?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<SpyModuleEstadoResult>;
