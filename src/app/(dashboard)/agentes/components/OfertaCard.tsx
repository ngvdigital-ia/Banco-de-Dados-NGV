"use client";

import { useState } from "react";
import {
  FileText,
  Play,
  Clock,
  CheckCircle2,
  CheckCheck,
  X,
  ThumbsUp,
  ThumbsDown,
  FileDown,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Oferta, EstadoAgente } from "@/types/agentes";

interface OfertaCardProps {
  oferta: Oferta;
  estado: EstadoAgente;
  agente: "black" | "white";
  onAction?: (oferta: Oferta, action: "approve" | "reject") => void;
}

const BORDA_ESQUERDA_POR_ESTADO: Record<EstadoAgente, string> = {
  em_execucao: "border-l-amber-500",
  pra_hoje: "border-l-green-600",
  pra_amanha: "border-l-slate-400",
  executada: "border-l-blue-600",
};

function getScoreVariant(score?: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (score === undefined)
    return { bg: "bg-slate-100", text: "text-slate-700", label: "-/10" };
  if (score >= 9)
    return { bg: "bg-green-100", text: "text-green-900", label: `${score}/10` };
  if (score >= 7)
    return { bg: "bg-amber-100", text: "text-amber-900", label: `${score}/10` };
  return { bg: "bg-red-100", text: "text-red-900", label: `${score}/10` };
}

function formatDurationFrom(isoStart: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60}min`;
}

export function OfertaCard({ oferta, estado, agente, onAction }: OfertaCardProps) {
  const agenteEstado = oferta.agentes[agente];
  const borda = BORDA_ESQUERDA_POR_ESTADO[estado];
  const score = agenteEstado.produto?.revisor_score;
  const scoreVariant = getScoreVariant(score);
  const pulsar = estado === "em_execucao";
  const approval = agenteEstado.approval;
  const [isReexecuting, setIsReexecuting] = useState(false);

  async function handleReexecutar() {
    if (
      !window.confirm(
        `Re-executar o agente Black para "${oferta.nome}"? Isso inicia uma nova execução no n8n.`,
      )
    ) {
      return;
    }
    setIsReexecuting(true);
    try {
      const res = await fetch("/api/agentes/black/re-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: oferta.task_id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("Re-execução do Black disparada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.error(`Falha ao re-executar: ${msg}`);
    } finally {
      setIsReexecuting(false);
    }
  }

  return (
    <article
      className={`bg-card border rounded-md border-l-2 ${borda} p-3 transition-colors hover:border-slate-300`}
    >
      <p className="text-sm font-medium mb-2 line-clamp-2">{oferta.nome}</p>

      <div className="flex gap-1.5 flex-wrap mb-2">
        {oferta.nicho && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 font-normal bg-teal-50 text-teal-900 hover:bg-teal-100"
          >
            {oferta.nicho}
          </Badge>
        )}
        {oferta.idioma && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 font-normal bg-purple-50 text-purple-900 hover:bg-purple-100"
          >
            {oferta.idioma}
          </Badge>
        )}
      </div>

      {oferta.documento_principal_url && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <a
            href={oferta.documento_principal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline truncate"
          >
            Doc principal
          </a>
        </div>
      )}

      {estado === "em_execucao" && agenteEstado.execution && (
        <div
          className={`flex items-center gap-1.5 text-xs text-amber-700 ${
            pulsar ? "animate-pulse" : ""
          }`}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Rodando há {formatDurationFrom(agenteEstado.execution.started_at)}
          </span>
        </div>
      )}

      {estado === "pra_hoje" && (
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {agente === "white"
              ? "Pronto pra disparar (não rodou ainda)"
              : "Pronto pra disparar"}
          </span>
        </div>
      )}

      {estado === "pra_amanha" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Aguardando subs predecessoras</span>
        </div>
      )}

      {estado === "executada" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2
              className="h-3.5 w-3.5 text-blue-700"
              aria-hidden="true"
            />
            {score !== undefined ? (
              <>
                <span className="text-muted-foreground">Score Revisor:</span>
                <Badge
                  className={`${scoreVariant.bg} ${scoreVariant.text} text-[10px] px-1.5 py-0 font-medium`}
                >
                  {scoreVariant.label}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">Executada</span>
            )}
          </div>

          {agenteEstado.produto?.drive_url && (
            <div className="flex items-center gap-1.5 text-xs">
              <FileDown
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <a
                href={agenteEstado.produto.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline"
              >
                Produto gerado ↗
              </a>
            </div>
          )}

          {approval ? (
            <div className="flex items-center gap-1.5 text-xs pt-1 border-t">
              {approval.action === "approved" ? (
                <>
                  <CheckCheck
                    className="h-3.5 w-3.5 text-green-700"
                    aria-hidden="true"
                  />
                  <span className="text-green-700 font-medium">Aprovado</span>
                </>
              ) : (
                <>
                  <X
                    className="h-3.5 w-3.5 text-red-700"
                    aria-hidden="true"
                  />
                  <span className="text-red-700 font-medium">Rejeitado</span>
                </>
              )}
              <span className="text-muted-foreground text-[10px]">
                por {approval.user_email.split("@")[0]}
              </span>
            </div>
          ) : (
            onAction && (
              <div className="flex gap-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(oferta, "approve");
                  }}
                >
                  <ThumbsUp className="h-3 w-3" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(oferta, "reject");
                  }}
                >
                  <ThumbsDown className="h-3 w-3" />
                  Rejeitar
                </Button>
              </div>
            )
          )}

          {agente === "black" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={isReexecuting}
              onClick={(e) => {
                e.stopPropagation();
                void handleReexecutar();
              }}
            >
              {isReexecuting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              {isReexecuting ? "Disparando..." : "Re-executar Black"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
