// Declaração de tipos pro núcleo .mjs — mesma convenção de avaliacao.d.mts (ver comentário lá:
// sem isso o TS infere `any` implícito nos parâmetros e o gate C10 reprova o componente que usa).

import type { SpyLeitura, SpyOferta } from "@/lib/sistemas/spy/estado-client.mjs";

export declare function chaveOrdem(data: string, periodo: "manha" | "noite"): string;

export declare function leituraExistente(
  leituras: SpyLeitura[],
  ofertaId: string,
  data: string,
  periodo: "manha" | "noite",
): SpyLeitura | null;

export declare function leituraAnterior(
  leituras: SpyLeitura[],
  ofertaId: string,
  data: string,
  periodo: "manha" | "noite",
): SpyLeitura | null;

export interface Movimento {
  delta: number;
  pct: number;
}

export declare function calcularMovimento(
  valorTexto: string | null | undefined,
  anteriorAds: number | null | undefined,
): Movimento | null;

export declare function leituraCompletaParaTodas(
  ofertas: Pick<SpyOferta, "id">[],
  leituras: SpyLeitura[],
  data: string,
  periodo: "manha" | "noite",
): boolean;

export interface ItemLote {
  id: string;
  ofertaId: string;
  data: string;
  periodo: "manha" | "noite";
  ads: number;
}

export declare function montarItensLote(params: {
  ofertas: Pick<SpyOferta, "id">[];
  leituras: SpyLeitura[];
  data: string;
  periodo: "manha" | "noite";
  valores: Record<string, string>;
  gerarId: () => string;
}): ItemLote[];

export declare function repetirContagensAnteriores(
  ofertas: Pick<SpyOferta, "id">[],
  leituras: SpyLeitura[],
  data: string,
  periodo: "manha" | "noite",
): Record<string, string>;
