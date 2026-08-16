// Declaração de tipos pro núcleo .mjs (mesma convenção .d.mts ao lado de .mjs que o TS resolve sob
// "moduleResolution": "bundler" — ver src/lib/sistemas/spy/estado-client.d.mts, mesmo motivo: sem
// isso o TS infere os parâmetros das funções sem JSDoc como `any` implícito e os componentes que
// consomem este módulo perdem a checagem de tipo (e caem no gate C10 — nada de `any` casual).

import type { SpyLeitura, SpyOferta, SpyPesos } from "@/lib/sistemas/spy/estado-client.mjs";

export declare function ordemLeitura(leitura: Pick<SpyLeitura, "data" | "periodo">): string;

export declare function serieDaOferta(leituras: SpyLeitura[], ofertaId: string): SpyLeitura[];

export declare function porDia(serie: SpyLeitura[]): { data: string; ads: number }[];

export interface Avaliacao {
  serie: SpyLeitura[];
  n: number;
  atual: number;
  dias: number;
  diasReg: number;
  emEscala: number;
  seqAtual: number;
  foraEscala: Set<string>;
  razao: number;
  pico: number;
  nota: number;
  estab: number;
  vol: number;
  tempo: number;
  pouco: boolean;
  delta: number;
  ultima: SpyLeitura | null;
}

export declare function avaliarOferta(
  oferta: Pick<SpyOferta, "id">,
  leituras: SpyLeitura[],
  pesos: SpyPesos,
  tolerancia: number,
  tetoVolume: number,
): Avaliacao;

export interface Situacao {
  classe: "pouco" | "morrendo" | "caindo" | "subindo" | "estavel";
  txt: string;
}

export declare function situacaoOferta(avaliacao: Avaliacao): Situacao;

export interface Veredito {
  txt: "acompanhar mais" | "traduzir" | "candidata forte" | "observar" | "descartar";
  tom: "neutro" | "sucesso" | "info" | "alerta" | "perigo";
}

export declare function veredictoDaNota(nota: number, pouco: boolean): Veredito;

export declare function avaliarTodasOfertas(
  ofertas: Pick<SpyOferta, "id">[],
  leituras: SpyLeitura[],
  pesos: SpyPesos,
  tolerancia: number,
): Record<string, Avaliacao>;

export interface ResumoOfertas<T> {
  totalAds: number;
  prontas: number;
  semQuebra: number;
  lider: T | null;
}

export declare function resumoOfertas<T extends { id: string }>(
  ofertas: T[],
  mapa: Record<string, Avaliacao>,
): ResumoOfertas<T>;
