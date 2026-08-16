import type { SpyOferta } from "@/lib/sistemas/spy/estado-client.mjs";
import type { SpyCreateOfertaInput, SpyUpdateOfertaPatch } from "@/lib/sistemas/spy/mutations-client.mjs";

export declare const CAMPOS_OFERTA: readonly [
  "nome",
  "formato",
  "nicho",
  "idioma",
  "link",
  "cloaker",
  "tipo_produto",
];

export interface OfertaFormValues {
  nome: string;
  formato: string;
  nicho: string;
  idioma: string;
  cloaker: string;
  tipoProduto: string;
  link: string;
}

export declare function construirInputCriacao(
  form: OfertaFormValues,
  gerarId: () => string,
): SpyCreateOfertaInput;

export declare function construirPatchEdicao(
  original: SpyOferta,
  form: OfertaFormValues,
): SpyUpdateOfertaPatch;

export declare function patchVazio(patch: SpyUpdateOfertaPatch): boolean;

export declare function nomeDuplicado(
  ofertas: Pick<SpyOferta, "id" | "nome">[],
  nome: string,
  ignorarId: string | null,
): boolean;

export declare function formularioVazio(): OfertaFormValues;

export declare function formularioDaOferta(oferta: SpyOferta): OfertaFormValues;
