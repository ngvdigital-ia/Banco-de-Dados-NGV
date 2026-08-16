import type { SpyLeitura, SpyOferta } from "@/lib/sistemas/spy/estado-client.mjs";

export declare const FORMATOS_CONHECIDOS: readonly string[];

export interface OfertaImportada {
  id: string;
  nome: string;
  formato: string;
  nicho: string;
  idioma: string;
  link: string;
}

export interface LeituraImportada {
  id: string;
  ofertaId: string;
  data: string;
  periodo: "manha" | "noite";
  ads: number;
}

export interface ResultadoImportacao {
  ofertasNovas: OfertaImportada[];
  ofertasEditadas: OfertaImportada[];
  leiturasTocadas: LeituraImportada[];
  ignoradas: number;
}

export declare function parseImportacao(
  texto: string,
  ofertasExistentes: Pick<SpyOferta, "id" | "nome" | "formato" | "nicho" | "idioma">[],
  leiturasExistentes: SpyLeitura[],
  gerarId: () => string,
): ResultadoImportacao;

export declare function construirCsv(ofertas: SpyOferta[], leituras: SpyLeitura[]): string;

export declare function backupValido(objeto: unknown): boolean;
