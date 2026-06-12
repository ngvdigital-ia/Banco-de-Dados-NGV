"use client";

import {
  FileText,
  Play,
  Clock,
  Clock4,
  CheckCircle2,
  CheckCheck,
  X,
  ThumbsUp,
  ThumbsDown,
  FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Oferta, EstadoAgente } from "@/types/agentes";

interface OfertaCardProps {
  oferta: Oferta;
  estado: EstadoAgente;
  agente: "black" | "white";
  onAction?: (
    oferta: Oferta,
    action: "approve" | "reject",
    agente: "black" | "white",
  ) => void;
}

const BORDA_POR_ESTADO: Record<EstadoAgente, string> = {
  em_execucao: "border-l-warning",
  pra_hoje:   "border-l-success",
  pra_amanha: "border-l-border",
  executada:  "border-l-info",
};

interface ScoreVariant {
  text: string;
  label: string;
  dot: string;
}

function getScoreVariant(score?: number): ScoreVariant {
  if (score === undefined)
    return {
      text: "text-muted-foreground",
      dot: "bg-muted-foreground/40",
      label: "–",
    };
  if (score >= 9)
    return {
      text: "text-success",
      dot: "bg-success",
      label: String(score),
    };
  if (score >= 7)
    return {
      text: "text-warning",
      dot: "bg-warning",
      label: String(score),
    };
  return {
    text: "text-danger",
    dot: "bg-danger",
    label: String(score),
  };
}

function formatDurationFrom(isoStart: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60}min`;
}

/** Retorna a idade em dias completos desde `isoDate`. */
function idadeEmDias(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

interface IdadeBadgeProps {
  ultimaAtividadeEm: string | null;
}

function IdadeBadge({ ultimaAtividadeEm }: IdadeBadgeProps) {
  if (!ultimaAtividadeEm) return null;
  const dias = idadeEmDias(ultimaAtividadeEm);
  const label = dias === 0 ? "hoje" : `há ${dias}d`;
  const dataCompleta = new Date(ultimaAtividadeEm).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const corClasse =
    dias >= 7
      ? "text-danger border-danger/40 bg-danger/5"
      : dias >= 3
        ? "text-warning border-warning/40 bg-warning/5"
        : "text-muted-foreground border-border bg-transparent";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium tabular-nums",
        corClasse,
      )}
      title={`Última atividade: ${dataCompleta}`}
    >
      {label}
    </span>
  );
}

export function OfertaCard({ oferta, estado, agente, onAction }: OfertaCardProps) {
  const agenteEstado = oferta.agentes[agente];
  const borda = BORDA_POR_ESTADO[estado];
  const score = agenteEstado.produto?.revisor_score;
  const scoreVariant = getScoreVariant(score);
  const approval = agenteEstado.approval;

  return (
    <article
      className={cn(
        // Base
        "bg-card border rounded-md border-l-[3px] p-3",
        // Entrada animada
        "animate-in fade-in duration-200",
        // Hover: sombra suave + lift sutil
        "transition-all duration-150 ease-out",
        "hover:-translate-y-px hover:shadow-md hover:border-primary/30",
        borda,
      )}
    >
      {/* Score do Revisor — destaque absoluto, aparece primeiro */}
      {estado === "executada" && score !== undefined && (
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums leading-none",
              scoreVariant.text,
            )}
            aria-label={`Score do revisor: ${score} de 10`}
          >
            {scoreVariant.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
            / 10
          </span>
          <span
            className={cn("ml-auto h-2 w-2 rounded-full flex-shrink-0", scoreVariant.dot)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Nome da oferta + badge de idade */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium line-clamp-2 leading-snug flex-1">{oferta.nome}</p>
        <IdadeBadge ultimaAtividadeEm={oferta.ultima_atividade_em} />
      </div>

      {/* Tags de nicho e idioma */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {oferta.nicho && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 font-normal bg-info-muted text-info-muted-foreground hover:bg-info-muted"
          >
            {oferta.nicho}
          </Badge>
        )}
        {oferta.idioma && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 font-normal bg-primary/10 text-primary hover:bg-primary/15"
          >
            {oferta.idioma}
          </Badge>
        )}
      </div>

      {/* Doc principal */}
      {oferta.documento_principal_url && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <a
            href={oferta.documento_principal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:text-info hover:underline truncate transition-colors duration-150"
          >
            Doc principal
          </a>
        </div>
      )}

      {/* Estado: em execução */}
      {estado === "em_execucao" && agenteEstado.execution && (
        <div className="flex items-center gap-1.5 text-xs text-warning">
          <Play className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          <span>
            Rodando há {formatDurationFrom(agenteEstado.execution.started_at)}
          </span>
        </div>
      )}

      {/* Estado: pra hoje */}
      {estado === "pra_hoje" && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <Clock4 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {agente === "white"
              ? "Na fila — não rodou ainda"
              : "Na fila pra disparar"}
          </span>
        </div>
      )}

      {/* Estado: pra amanhã */}
      {estado === "pra_amanha" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Aguardando subs predecessoras</span>
        </div>
      )}

      {/* Estado: executada */}
      {estado === "executada" && (
        <div className="space-y-2">
          {/* Linha de status + link de produto */}
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" aria-hidden="true" />
            {score !== undefined ? (
              <span className="text-muted-foreground">Revisado pelo agente</span>
            ) : (
              <span className="text-muted-foreground">Executada</span>
            )}
          </div>

          {agenteEstado.produto?.drive_url && (
            <div className="flex items-center gap-1.5 text-xs">
              <FileDown className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden="true" />
              <a
                href={agenteEstado.produto.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline transition-colors duration-150"
              >
                Produto gerado ↗
              </a>
            </div>
          )}

          {/* Aprovação/rejeição ou botões de ação */}
          {approval ? (
            <div className="flex items-center gap-1.5 text-xs pt-1.5 border-t border-border/60">
              {approval.action === "approved" ? (
                <>
                  <CheckCheck className="h-3.5 w-3.5 text-success flex-shrink-0" aria-hidden="true" />
                  <span className="text-success font-medium">Aprovado</span>
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5 text-danger flex-shrink-0" aria-hidden="true" />
                  <span className="text-danger font-medium">Rejeitado</span>
                </>
              )}
              <span className="text-muted-foreground text-[10px] ml-auto">
                {approval.user_email.split("@")[0]}
              </span>
            </div>
          ) : (
            onAction && (
              <div className="flex gap-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 flex-1 hover:bg-success-muted hover:text-success-muted-foreground hover:border-success transition-colors duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(oferta, "approve", agente);
                  }}
                >
                  <ThumbsUp className="h-3 w-3" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 flex-1 hover:bg-danger-muted hover:text-danger-muted-foreground hover:border-danger transition-colors duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(oferta, "reject", agente);
                  }}
                >
                  <ThumbsDown className="h-3 w-3" />
                  Rejeitar
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}
