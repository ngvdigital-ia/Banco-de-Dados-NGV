// Tipos do núcleo puro da tela de lookup de Apps (/sistemas/apps-ofertas).

export type LookupTom = "neutro" | "info" | "aviso" | "erro";

export type LookupEstado =
  | "idle"
  | "loading"
  | "found"
  | "empty"
  | "invalid"
  | "unauthorized"
  | "disabled"
  | "error";

export declare const APPS_LOOKUP_ESTADOS: {
  readonly IDLE: "idle";
  readonly LOADING: "loading";
  readonly FOUND: "found";
  readonly EMPTY: "empty";
  readonly INVALID: "invalid";
  readonly UNAUTHORIZED: "unauthorized";
  readonly DISABLED: "disabled";
  readonly ERROR: "error";
};

export interface LookupDescricao {
  estado: LookupEstado;
  titulo: string;
  detalhe: string;
  tom: LookupTom;
}

export declare function descreverLookup(entrada?: {
  fase?: "idle" | "loading" | "done";
  status?: number;
  body?: Record<string, unknown>;
  falhou?: boolean;
}): LookupDescricao;

export interface EspelhoAviso {
  medido: boolean;
  completo: boolean;
  projetados: number | null;
  naFonte: number | null;
  faltando: number | null;
  idadeHoras: number | null;
  titulo: string;
  detalhe: string;
  tom: "aviso" | "info";
}

export declare function descreverEspelhoApps(summary: unknown): EspelhoAviso;

export declare function descreverEstadoProduto(state: unknown): {
  rotulo: string;
  variante: "success" | "info" | "neutral" | "warning";
};
