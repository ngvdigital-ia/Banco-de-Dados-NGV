"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Play,
} from "lucide-react";
import { StateSection } from "./StateSection";
import type { Oferta, EstadoAgente } from "@/types/agentes";

interface AgentColumnProps {
  titulo: string;
  corDestaque: string;
  ofertas: Oferta[];
  agente: "black" | "white";
  onAction?: (
    oferta: Oferta,
    action: "approve" | "reject",
    agente: "black" | "white",
  ) => void;
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

  const executadas = ofertasPorEstado.executada.length;
  const emExecucao = ofertasPorEstado.em_execucao.length;
  const pendentes =
    ofertasPorEstado.pra_hoje.length + ofertasPorEstado.pra_amanha.length;

  const storageKey = `agentes-column-collapsed-${agente}`;
  const [collapsed, setCollapsed] = useState(false);

  // Hidrata o estado salvo (efeito só roda no client — localStorage é seguro aqui).
  // setState no effect é intencional: ler localStorage no lazy-init do useState
  // causaria hydration mismatch no SSR; effect client-only é o padrão correto.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(storageKey) === "true") setCollapsed(true);
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(collapsed));
  }, [collapsed, storageKey]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md">
        <div
          className={`w-2.5 h-2.5 rounded-full ${corDestaque}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{titulo}</span>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Executadas">
            <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" />
            {executadas}
          </span>
          <span className="flex items-center gap-1" title="Em execução">
            <Play className="h-3 w-3 text-warning" aria-hidden="true" />
            {emExecucao}
          </span>
          <span
            className="flex items-center gap-1"
            title="Pendentes (pra hoje + pra amanhã)"
          >
            <Clock className="h-3 w-3 text-slate-500" aria-hidden="true" />
            {pendentes}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expandir coluna" : "Colapsar coluna"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed &&
        ESTADOS_ORDEM.map((estado) => (
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
