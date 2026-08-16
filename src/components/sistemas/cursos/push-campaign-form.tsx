"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { collectPushPreviewIssues } from "./validate-push-preview";
import type { CursosPushFormState, CursosPushSegmentKey } from "./types";

// Tela de COMPOSIÇÃO da campanha de push (Cursos, Fase 4). Monta e valida o payload
// que iria pro adapter server-to-server em src/lib/sistemas/cursos/, mas o botão de
// envio fica SEMPRE desabilitado por decisão do operador — infraestrutura pronta,
// disparo real desligado até haver forma segura de testar sem notificar aluno de
// verdade. Este componente NUNCA importa a função de disparo (adapter) nem o wrapper
// de auditoria daquela pasta — não existe caminho de código daqui até o OneSignal.
// Regressão coberta por tests/sistemas-cursos-push-ui-disabled.test.mjs.
const SEGMENT_OPTIONS: { value: CursosPushSegmentKey; label: string; hint: string }[] = [
  { value: "total", label: "Todos os usuários", hint: "Total Subscriptions" },
  { value: "students", label: "Apenas alunos", hint: "tag active_courses != none" },
  { value: "leads", label: "Apenas leads", hint: "tag active_courses = none" },
];

// kiss: não existe primitivo <Textarea> em src/components/ui hoje — mesma classe do
// <Input/> aplicada a um <textarea> nativo. Se um segundo caller precisar de
// textarea, aí sim vale extrair um componente ui/textarea.tsx.
const textareaClass = cn(
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

const emptyButton = () => ({ id: crypto.randomUUID(), text: "", url: "" });

const initialForm: CursosPushFormState = {
  title: "",
  message: "",
  imageUrl: "",
  launchUrl: "",
  buttons: [],
  segment: "total",
  scheduleTime: "",
};

export function CursosPushCampaignForm() {
  const [form, setForm] = useState<CursosPushFormState>(initialForm);

  const issues = useMemo(() => collectPushPreviewIssues(form), [form]);

  const updateButton = (index: number, field: "text" | "url", value: string) => {
    setForm((prev) => {
      const nextButtons = [...prev.buttons];
      nextButtons[index] = { ...nextButtons[index], [field]: value };
      return { ...prev, buttons: nextButtons };
    });
  };

  const addButton = () => setForm((prev) => ({ ...prev, buttons: [...prev.buttons, emptyButton()] }));
  const removeButton = (index: number) =>
    setForm((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }));

  return (
    <div className="space-y-5">
      <section
        className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-muted p-4"
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-warning-muted-foreground">Disparo desabilitado nesta fase</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Esta tela monta e valida a campanha, mas o botão de envio abaixo nunca dispara notificação real —
            infraestrutura pronta, ligação pendente de o operador definir como testar sem notificar aluno de
            verdade. Nenhuma flag deste ambiente liga esse disparo.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="gap-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="cursos-push-title">Título</Label>
            <Input
              id="cursos-push-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Nova aula disponível!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cursos-push-message">Mensagem</Label>
            <textarea
              id="cursos-push-message"
              className={textareaClass}
              rows={2}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Assista agora e avance no curso. Se vazio, usa o título."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cursos-push-image">URL da imagem (Big Picture)</Label>
              <Input
                id="cursos-push-image"
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://cdn.exemplo.com/aula.jpg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cursos-push-launch">URL de destino (deep link)</Label>
              <Input
                id="cursos-push-launch"
                value={form.launchUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, launchUrl: e.target.value }))}
                placeholder="/courses/skyvault?lesson=xyz"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cursos-push-segment">Segmento</Label>
              <Select
                value={form.segment}
                onValueChange={(value) => value && setForm((prev) => ({ ...prev, segment: value as CursosPushSegmentKey }))}
              >
                <SelectTrigger id="cursos-push-segment" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} ({opt.hint})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cursos-push-schedule">Agendamento (HH:MM, opcional)</Label>
              <Input
                id="cursos-push-schedule"
                value={form.scheduleTime}
                onChange={(e) => setForm((prev) => ({ ...prev, scheduleTime: e.target.value }))}
                placeholder="20:00"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Botões</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addButton}>
                <Plus /> Adicionar botão
              </Button>
            </div>
            {form.buttons.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum botão adicionado.</p>
            ) : (
              <div className="space-y-3">
                {form.buttons.map((button, index) => (
                  <div key={button.id} className="rounded-lg border border-border p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Texto</Label>
                        <Input value={button.text} onChange={(e) => updateButton(index, "text", e.target.value)} placeholder="Assistir agora" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">URL (opcional)</Label>
                        <Input value={button.url} onChange={(e) => updateButton(index, "url", e.target.value)} placeholder="/courses/..." />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeButton(index)}>
                        <Trash2 /> Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Validação do payload</h2>
            <StatusBadge variant={issues.length === 0 ? "success" : "warning"}>
              {issues.length === 0 ? "Payload válido" : `${issues.length} pendência(s)`}
            </StatusBadge>
          </div>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Campos obrigatórios preenchidos e formatos reconhecidos. Isto NÃO envia nada — só confirma que o
              payload que seria montado é válido.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {issues.map((issue) => (
                <li key={issue.field} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              disabled
              aria-disabled="true"
              title="Disparo real desligado nesta fase — infraestrutura pronta, aguardando o operador habilitar."
              className="w-full"
            >
              Enviar campanha (desabilitado)
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Este botão nunca chama o OneSignal — não existe caminho de código deste formulário até o disparo
              real nesta fase.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
