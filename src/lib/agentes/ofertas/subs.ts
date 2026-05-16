import { ClickUpTask, findSubtaskByName } from "@/lib/agentes/clickup/tasks";

export const SUBS_PREDECESSORAS_BLACK = [
  "Escrita da VSL",
  "Revisão Diogo",
  "Página VSL no Vturb",
];

export const SUB_GATILHO_BLACK = "Tradução da VSL";

export interface SubsStatusBlack {
  escrita_vsl?: string;
  revisao_diogo?: string;
  pagina_vsl_vturb?: string;
  traducao_vsl?: string;
}

export function extractSubsStatusBlack(oferta: ClickUpTask): SubsStatusBlack {
  return {
    escrita_vsl: findSubtaskByName(oferta, "Escrita da VSL")?.status.status,
    revisao_diogo: findSubtaskByName(oferta, "Revisão Diogo")?.status.status,
    pagina_vsl_vturb: findSubtaskByName(oferta, "Página VSL no Vturb")?.status
      .status,
    traducao_vsl: findSubtaskByName(oferta, "Tradução da VSL")?.status.status,
  };
}

export function predecessorasFinalizadasBlack(subs: SubsStatusBlack): boolean {
  const predecessoras = [
    subs.escrita_vsl,
    subs.revisao_diogo,
    subs.pagina_vsl_vturb,
  ];
  // Trata undefined como "sub não existe nessa oferta" (template antigo).
  // Só requer que as subs presentes estejam finalizadas.
  const existentes = predecessoras.filter((s) => s !== undefined);
  if (existentes.length === 0) return false; // sem predecessoras documentadas: conservador
  return existentes.every((s) => s === "finalizado");
}

export function subGatilhoFinalizadaBlack(subs: SubsStatusBlack): boolean {
  return subs.traducao_vsl === "finalizado";
}
