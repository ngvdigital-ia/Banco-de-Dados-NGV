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
  const router = useRouter();

  useEffect(() => {
    if (!oferta) {
      setFeedbackText("");
      setAudioBlob(null);
      setIsSubmitting(false);
      setIsTranscribing(false);
    }
  }, [oferta]);

  if (!oferta || !action) return null;

  const isReject = action === "reject";
  const agenteEstado = oferta.agentes[agente];
  const produto = agenteEstado.produto;

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
        }),
      });

      if (!approvalRes.ok) {
        const err = await approvalRes.json();
        throw new Error(err.error ?? `HTTP ${approvalRes.status}`);
      }

      toast.success(
        action === "approve" ? "Aprovada" : "Rejeitada com feedback",
      );
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
              {isTranscribing
                ? "Transcrevendo áudio..."
                : isSubmitting
                  ? "Salvando..."
                  : isReject
                    ? "Confirmar rejeição"
                    : "Confirmar aprovação"}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
