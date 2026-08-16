// Declaração de tipos pro adapter .mjs (mesma convenção .d.mts ao lado de .mjs — ver
// estado-client.d.mts, mesmo motivo: sem isso o TS larga `kind` pra `string` (widened), quebrando
// a união discriminada que os wrappers/componentes dependem pra estreitar o tipo).

export declare const SPY_LOGIN_PATH: "/api/auth";
export declare const SPY_OFERTAS_PATH: "/api/ofertas";
export declare const SPY_LEITURAS_PATH: "/api/leituras";
export declare const SPY_CONFIG_PATH: "/api/config";

export declare class SpyModuleMutationError extends Error {
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

export interface SpyOk {
  ok: true;
}

export interface SpyLeiturasBatchResult {
  leituras: SpyLeitura[];
}

export interface SpyConfigResult {
  pesos: SpyPesos;
  tolerancia: number;
}

export type SpyMutationResult<TData> =
  | { kind: "not_configured"; reason: string; mutatedAt: null; data: null }
  | { kind: "error"; code: string; mutatedAt: null; data: null }
  | { kind: "success"; mutatedAt: string; data: TData };

export interface SpyMutationOptions {
  origin?: string;
  password?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface SpyCreateOfertaInput {
  id: string;
  nome: string;
  formato?: string | null;
  nicho?: string | null;
  idioma?: string | null;
  link?: string | null;
  cloaker?: "sim" | "nao" | "talvez" | null | "";
  tipo_produto?: "infoproduto" | "nao_identificado" | null | "";
}

export interface SpyUpdateOfertaPatch {
  nome?: string | null;
  formato?: string | null;
  nicho?: string | null;
  idioma?: string | null;
  link?: string | null;
  cloaker?: "sim" | "nao" | "talvez" | null | "";
  tipo_produto?: "infoproduto" | "nao_identificado" | null | "";
}

export interface SpyLeituraItemInput {
  id: string;
  ofertaId: string;
  data: string;
  periodo: "manha" | "noite";
  ads: number;
}

export declare function createSpyOferta(
  input: SpyCreateOfertaInput,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOferta>>;

export declare function updateSpyOferta(
  id: string,
  patch: SpyUpdateOfertaPatch,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOferta>>;

export declare function deleteSpyOferta(
  id: string,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOk>>;

export declare function saveSpyLeiturasBatch(
  itens: SpyLeituraItemInput[],
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyLeiturasBatchResult>>;

export declare function updateSpyLeitura(
  id: string,
  ads: number,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyLeitura>>;

export declare function deleteSpyLeitura(
  id: string,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyOk>>;

export declare function updateSpyConfig(
  pesos: SpyPesos,
  tolerancia: number,
  options?: SpyMutationOptions,
): Promise<SpyMutationResult<SpyConfigResult>>;
