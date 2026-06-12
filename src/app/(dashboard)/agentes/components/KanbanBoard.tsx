"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { DashboardHeader } from "./DashboardHeader";
import { AgentColumn } from "./AgentColumn";
import { TriagemPlaceholder } from "./TriagemPlaceholder";
import { EmptyKanban } from "./EmptyKanban";
import { ApprovalSheet } from "./ApprovalSheet";
import { cn } from "@/lib/utils";
import type { Oferta } from "@/types/agentes";

function idadeEmDias(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

function contarParadas(ofertas: Oferta[]): { total3d: number; alguma7d: boolean } {
  let total3d = 0;
  let alguma7d = false;
  for (const o of ofertas) {
    if (!o.ultima_atividade_em) continue;
    const dias = idadeEmDias(o.ultima_atividade_em);
    if (dias >= 3) {
      total3d++;
      if (dias >= 7) alguma7d = true;
    }
  }
  return { total3d, alguma7d };
}

interface KanbanBoardProps {
  initialOfertas: Oferta[];
  initialAtualizadoEm: string;
}

interface ApprovalState {
  oferta: Oferta;
  action: "approve" | "reject";
  agente: "black" | "white";
}

export function KanbanBoard({
  initialOfertas,
  initialAtualizadoEm,
}: KanbanBoardProps) {
  const [ofertas, setOfertas] = useState<Oferta[]>(initialOfertas);
  const [atualizadoEm, setAtualizadoEm] = useState(initialAtualizadoEm);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [approvalState, setApprovalState] = useState<ApprovalState | null>(null);
  const router = useRouter();

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/agentes/ofertas", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Sessão expirada. Recarregando...");
          router.refresh();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setOfertas(data.ofertas);
      setAtualizadoEm(data.atualizado_em);
      toast.success(`${data.ofertas.length} ofertas atualizadas`);
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      const msg = err instanceof Error ? err.message : "desconhecido";
      toast.error(`Falha ao atualizar: ${msg}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleAction(
    oferta: Oferta,
    action: "approve" | "reject",
    agente: "black" | "white",
  ) {
    setApprovalState({ oferta, action, agente });
  }

  async function handleApprovalSuccess() {
    setApprovalState(null);
    await handleRefresh();
  }

  const { total3d, alguma7d } = contarParadas(ofertas);

  return (
    <div className="space-y-4">
      <DashboardHeader
        totalOfertas={ofertas.length}
        atualizadoEm={atualizadoEm}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {total3d > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
            alguma7d
              ? "border-danger/40 bg-danger/5 text-danger"
              : "border-warning/40 bg-warning/5 text-warning",
          )}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            {total3d} oferta{total3d > 1 ? "s" : ""} sem atividade há 3+ dias
          </span>
        </div>
      )}

      {ofertas.length === 0 ? (
        <EmptyKanban />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AgentColumn
            titulo="Cria Black"
            corDestaque="bg-slate-900"
            ofertas={ofertas}
            agente="black"
            onAction={handleAction}
          />
          <AgentColumn
            titulo="Cria White"
            corDestaque="bg-slate-300 border border-slate-400"
            ofertas={ofertas}
            agente="white"
            onAction={handleAction}
          />
          <TriagemPlaceholder />
        </div>
      )}

      <ApprovalSheet
        oferta={approvalState?.oferta ?? null}
        action={approvalState?.action ?? null}
        agente={approvalState?.agente ?? "black"}
        onClose={() => setApprovalState(null)}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}
