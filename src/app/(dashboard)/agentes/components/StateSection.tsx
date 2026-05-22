import { OfertaCard } from "./OfertaCard";
import type { Oferta, EstadoAgente } from "@/types/agentes";

interface StateSectionProps {
  label: string;
  estado: EstadoAgente;
  ofertas: Oferta[];
  agente: "black" | "white";
  onAction?: (
    oferta: Oferta,
    action: "approve" | "reject",
    agente: "black" | "white",
  ) => void;
}

export function StateSection({
  label,
  estado,
  ofertas,
  agente,
  onAction,
}: StateSectionProps) {
  return (
    <section>
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1 mt-3 mb-1.5">
        {label} · {ofertas.length}
      </h3>
      {ofertas.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 px-1 italic">
          Sem ofertas neste estado
        </p>
      ) : (
        <div className="space-y-2">
          {ofertas.map((oferta) => (
            <OfertaCard
              key={oferta.task_id}
              oferta={oferta}
              estado={estado}
              agente={agente}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}
