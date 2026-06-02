"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, Star, RefreshCw } from "lucide-react";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { Oferta } from "@/types/agentes";
import { cn } from "@/lib/utils";

interface ApprovalSheetProps {
  oferta: Oferta | null;
  action: "approve" | "reject" | null;
  agente: "black" | "white";
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function ApprovalSheet({
  oferta,
  action,
  agente,
  onClose,
  onSuccess,
}: ApprovalSheetProps) {
  const [feedbackText, setFeedbackText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [reexecutar, setReexecutar] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!oferta) {
      setFeedbackText("");
      setAudioBlob(null);
      setIsSubmitting(false);
      setIsTranscribing(false);
      setReexecutar(true);
    }
  }, [oferta]);

  if (!oferta || !action) return null;

  const isReject = action === "reject";
  const agenteEstado = oferta.agentes[agente];
  const produto = agenteEstado.produto;
  const podeReexecutar = isReject && agente === "black";

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      let finalFeedback = feedbackText.trim();

      if (audioBlob) {
        setIsTranscribing(true);
        const fd = new FormData();
        fd.append("audio", audioBlob, "feedback.webm");
        const transcribeRes = await fetch("/api/agentes/transcribe", {
          method: "POST",
          body: fd,
        });
        if (!transcribeRes.ok) {
          const errBody = await transcribeRes.text();
          throw new Error(
            `Transcrição falhou (${transcribeRes.status}): ${errBody.slice(0, 200)}`,
          );
        }
        const { text } = (await transcribeRes.json()) as { text: string };
        finalFeedback = finalFeedback
          ? `${finalFeedback}\n\n[Áudio]: ${text}`
          : text;
        setIsTranscribing(false);
      }

      const approvalRes = await fetch("/api/agentes/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: oferta!.task_id,
          agent: agente,
          action,
          feedback: finalFeedback || undefined,
          exec_id: agenteEstado.execution?.exec_id,
          session_id: agenteEstado.execution?.session_id,
          oferta_nome: oferta!.nome,
        }),
      });

      if (!approvalRes.ok) {
        const err = await approvalRes.json();
        throw new Error(err.error ?? `HTTP ${approvalRes.status}`);
      }

      if (action === "approve") {
        toast.success("Aprovada");
      } else {
        toast.success("Rejeição registrada");

        if (podeReexecutar && reexecutar) {
          try {
            const reexecRes = await fetch("/api/agentes/black/re-execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                task_id: oferta!.task_id,
                feedback: finalFeedback || undefined,
              }),
            });
            if (reexecRes.ok) {
              toast.success("Re-execução do Black disparada com o feedback");
            } else {
              const errBody = (await reexecRes.json().catch(() => ({}))) as {
                error?: string;
              };
              const motivo = errBody.error ?? `HTTP ${reexecRes.status}`;
              if (reexecRes.status === 422) {
                toast.warning(
                  `Atenção: re-execução do Black NÃO disparou. Motivo: ${motivo}. Verifique se a oferta tem a subtarefa "Tradução da VSL".`,
                  { duration: 12000 },
                );
              } else {
                toast.warning(
                  `Rejeição salva, mas a re-execução não pôde ser iniciada (${motivo}). Tente de novo em alguns minutos ou avise o time.`,
                  { duration: 12000 },
                );
              }
            }
          } catch {
            toast.warning(
              "Rejeição salva, mas a re-execução não pôde ser iniciada (erro de rede). Tente de novo em alguns minutos.",
              { duration: 12000 },
            );
          }
        }
      }

      await onSuccess();
      router.refresh();
    } catch (err) {
      console.error("Erro na submissão:", err);
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.error(`Falha: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setIsTranscribing(false);
    }
  }

  const botaoLabel = isTranscribing
    ? "Transcrevendo áudio…"
    : isSubmitting
      ? "Salvando…"
      : !isReject
        ? "Confirmar aprovação"
        : podeReexecutar
          ? reexecutar
            ? "Rejeitar e re-executar Black"
            : "Apenas rejeitar"
          : "Confirmar rejeição";

  return (
    <Sheet open={!!oferta} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {/* Header com marca colorida */}
        <SheetHeader className="pb-0">
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              isReject
                ? "border-danger/20 bg-danger-muted"
                : "border-success/20 bg-success-muted",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                isReject ? "bg-danger/15 text-danger" : "bg-success/15 text-success",
              )}
            >
              {isReject ? (
                <X className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle
                className={cn(
                  "text-base",
                  isReject ? "text-danger-muted-foreground" : "text-success-muted-foreground",
                )}
              >
                {isReject ? "Rejeitar produto" : "Aprovar produto"}
              </SheetTitle>
              <SheetDescription className="mt-0.5 truncate text-xs">
                {oferta.nome}
                <span className="mx-1.5 opacity-40">·</span>
                <span className="capitalize">{agente}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5 px-1">
          {/* Produto gerado */}
          {produto?.drive_url && (
            <InfoBlock label="Produto gerado">
              <a
                href={produto.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors duration-150"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Drive
              </a>
            </InfoBlock>
          )}

          {/* Score Revisor */}
          {produto?.revisor_score !== undefined && (
            <InfoBlock label="Score Revisor">
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-warning" />
                <span className="tabular-nums text-sm font-semibold">
                  {produto.revisor_score}
                  <span className="text-xs font-normal text-muted-foreground">/10</span>
                </span>
                <Badge
                  className={cn(
                    "text-xs",
                    produto.revisor_score >= 7
                      ? "bg-success-muted text-success-muted-foreground border-success"
                      : produto.revisor_score >= 5
                        ? "bg-warning-muted text-warning-muted-foreground border-warning"
                        : "bg-danger-muted text-danger-muted-foreground border-danger",
                  )}
                >
                  {produto.revisor_score >= 7
                    ? "Bom"
                    : produto.revisor_score >= 5
                      ? "Regular"
                      : "Fraco"}
                </Badge>
              </div>
            </InfoBlock>
          )}

          {(produto?.drive_url || produto?.revisor_score !== undefined) && (
            <Separator className="opacity-50" />
          )}

          {/* Feedback — rejeição */}
          {isReject && (
            <>
              <div className="space-y-1.5">
                <FieldLabel>Feedback escrito</FieldLabel>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Por que está rejeitando? Que ajustes você quer?"
                  rows={5}
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none resize-none",
                    "placeholder:text-muted-foreground/50",
                    "focus:ring-2 focus:ring-ring transition-shadow duration-150",
                    "hover:border-border/80",
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Ou áudio (transcrito automaticamente)</FieldLabel>
                <AudioRecorder
                  onRecorded={(blob) => setAudioBlob(blob)}
                  disabled={isSubmitting}
                />
              </div>

              {podeReexecutar && (
                <label
                  className={cn(
                    "flex items-start gap-3 cursor-pointer select-none rounded-xl border p-4 transition-all duration-150",
                    reexecutar
                      ? "border-primary/30 bg-primary/6"
                      : "border-border/50 bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={reexecutar}
                    onCheckedChange={(checked) => setReexecutar(checked === true)}
                    disabled={isSubmitting}
                    className="mt-0.5 shrink-0"
                    aria-label="Re-executar o Black com este feedback"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium">
                        Re-executar o Black com este feedback
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Gera nova versão usando seu feedback. Custa ~$0,50 de créditos Anthropic.
                    </span>
                  </div>
                </label>
              )}
            </>
          )}

          {/* Comentário — aprovação */}
          {!isReject && (
            <div className="space-y-1.5">
              <FieldLabel>Comentário (opcional)</FieldLabel>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Algum comentário sobre a aprovação?"
                rows={3}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none resize-none",
                  "placeholder:text-muted-foreground/50",
                  "focus:ring-2 focus:ring-ring transition-shadow duration-150",
                  "hover:border-border/80",
                )}
              />
            </div>
          )}

          <Separator className="opacity-50" />

          {/* Ações */}
          <div className="flex gap-2 pb-4">
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting || (isReject && !feedbackText.trim() && !audioBlob)
              }
              variant={isReject ? "destructive" : "default"}
              className="flex-1 gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {botaoLabel}
            </Button>
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

// Ícones inline pra evitar import desnecessário
function Check({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
