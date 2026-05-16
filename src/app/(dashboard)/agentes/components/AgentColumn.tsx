import { StateSection } from "./StateSection";
import type { Oferta, EstadoAgente } from "@/types/agentes";

interface AgentColumnProps {
  titulo: string;
  corDestaque: string;
  ofertas: Oferta[];
  agente: "black" | "white";
  onAction?: (oferta: Oferta, action: "approve" | "reject") => void;
}

const ESTADOS_ORDEM: EstadoAgente[] = [
  "em_execucao",
  "pra_hoje",
  "pra_amanha",
  "executada",
];

const ESTADO_LABEL: Record<EstadoAgente, string> = {
  em_execucao: "Em execução",
  pra_hoje: "Pra hoje",
  pra_amanha: "Pra amanhã",
  executada: "Executadas",
};

export function AgentColumn({
  titulo,
  corDestaque,
  ofertas,
  agente,
  onAction,
}: AgentColumnProps) {
  const ofertasPorEstado = ESTADOS_ORDEM.reduce(
    (acc, estado) => {
      acc[estado] = ofertas.filter((o) => o.agentes[agente].estado === estado);
      return acc;
    },
    {} as Record<EstadoAgente, Oferta[]>,
  );

  const resumo = `${ofertasPorEstado.executada.length} / ${ofertasPorEstado.pra_hoje.length} / ${ofertasPorEstado.pra_amanha.length}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md">
        <div
          className={`w-2.5 h-2.5 rounded-full ${corDestaque}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{titulo}</span>
        <span
          className="text-xs text-muted-foreground ml-auto"
          title="executadas / pra hoje / pra amanhã"
        >
          {resumo}
        </span>
      </div>

      {ESTADOS_ORDEM.map((estado) => (
        <StateSection
          key={estado}
          label={ESTADO_LABEL[estado]}
          estado={estado}
          ofertas={ofertasPorEstado[estado]}
          agente={agente}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
