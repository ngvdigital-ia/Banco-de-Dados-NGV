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
import { Loader2 } from "lucide-react";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { Oferta } from "@/types/agentes";

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
  // Re-executar o Black com o feedback ao rejeitar (default ligado).
  const [reexecutar, setReexecutar] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!oferta) {
      setFeedbackText("");
      setAudioBlob(null);
      setIsSubmitting(false);
      setIsTranscribing(false);
      setReexecutar(true); // volta ao default ON ao fechar/reabrir
    }
  }, [oferta]);

  if (!oferta || !action) return null;

  const isReject = action === "reject";
  const agenteEstado = oferta.agentes[agente];
  const produto = agenteEstado.produto;
  // Re-execução só existe pro Black (único com endpoint /re-execute hoje).
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

      // 1. Registra o approval — operação crítica. Se falhar, o request inteiro falha.
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

        // 2. Re-execução opcional do Black — INDEPENDENTE da rejeição. Se falhar,
        //    a rejeição NÃO é revertida; só avisamos o usuário de forma clara.
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
    ? "Transcrevendo áudio..."
    : isSubmitting
      ? "Salvando..."
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
        <SheetHeader>
          <SheetTitle>
            {isReject ? "Rejeitar produto" : "Aprovar produto"}
          </SheetTitle>
          <SheetDescription>
            {oferta.nome} · agente <span className="capitalize">{agente}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-4">
          {produto?.drive_url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                Produto gerado
              </p>
              <a
                href={produto.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline"
              >
                Abrir no Drive ↗
              </a>
            </div>
          )}

          {produto?.revisor_score !== undefined && (
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Score Revisor
              </p>
              <Badge>{produto.revisor_score}/10</Badge>
            </div>
          )}

          {isReject && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                  Feedback escrito
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Por que está rejeitando? Que ajustes você quer?"
                  rows={5}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-md outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                  Ou áudio (transcrito automaticamente)
                </label>
                <AudioRecorder
                  onRecorded={(blob) => setAudioBlob(blob)}
                  disabled={isSubmitting}
                />
              </div>

              {podeReexecutar && (
                <label className="flex items-start gap-2 cursor-pointer select-none rounded-md border bg-muted/40 p-3">
                  <input
                    type="checkbox"
                    checked={reexecutar}
                    onChange={(e) => setReexecutar(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm">
                    <span className="font-medium">
                      Re-executar o Black com este feedback
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Gera uma nova versão do produto usando o seu feedback. Custa
                      créditos da Anthropic (~$0,50 por execução).
                    </span>
                  </span>
                </label>
              )}
            </>
          )}

          {!isReject && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Comentário (opcional)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Algum comentário sobre a aprovação?"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-background border rounded-md outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
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
