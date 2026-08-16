"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { QUIZ_ANALYTICS_ORIGIN } from "@/lib/sistemas/quiz/analytics-client.mjs";

// Aba "Instalar tracker" (index (1).html:17,82-95 + dashboard.js:122-149 do dashboard
// vanilla original). NÃO chama endpoint nenhum — é template de string local; a única
// "escrita" é navigator.clipboard, por isso "use client" (o resto do módulo é 100%
// Server Component). Origin do Quiz vem de QUIZ_ANALYTICS_ORIGIN (mesmo adapter que já
// serve as outras 4 abas) — nunca hardcoded aqui de novo, pra não divergir se o painel
// externo mudar de domínio.
//
// kiss: não existe primitivo <Textarea> em src/components/ui hoje — mesma classe do
// <Input/> aplicada a um <textarea> nativo (mesmo atalho já usado em push-campaign-form.tsx).
// Extrai um ui/textarea.tsx se um 3º caller precisar.
const textareaClass = cn(
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

function buildTrackerSnippet(projectId: string, funnelId: string, pageId: string): string | null {
  const trimmedProject = projectId.trim();
  const trimmedFunnel = funnelId.trim();
  const trimmedPage = pageId.trim();
  if (!trimmedProject || !trimmedFunnel || !trimmedPage) return null;

  return [
    "<script",
    "  defer",
    `  src="${QUIZ_ANALYTICS_ORIGIN}/assets/tracker.js"`,
    `  data-nga-project-id="${trimmedProject}"`,
    `  data-nga-funnel-id="${trimmedFunnel}"`,
    `  data-nga-page-id="${trimmedPage}"`,
    `  data-nga-endpoint="${QUIZ_ANALYTICS_ORIGIN}/api/track"`,
    "></script>",
  ].join("\n");
}

export function InstallerPanel() {
  const [projectId, setProjectId] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [pageId, setPageId] = useState("");

  const snippet = useMemo(() => buildTrackerSnippet(projectId, funnelId, pageId), [projectId, funnelId, pageId]);

  const handleCopy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Trecho copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o trecho manualmente.");
    }
  };

  return (
    <Card className="gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Instalar tracker</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O mesmo <code className="rounded bg-muted px-1 py-0.5">tracker.js</code> serve todas as páginas. Informe os
          identificadores desta página e cole o trecho antes de{" "}
          <code className="rounded bg-muted px-1 py-0.5">&lt;/head&gt;</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-project">Project ID</Label>
          <Input
            id="quiz-installer-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="ex.: oferta-verao"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-funnel">Funnel ID</Label>
          <Input
            id="quiz-installer-funnel"
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            placeholder="ex.: vsl-principal"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-page">Page ID</Label>
          <Input
            id="quiz-installer-page"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="ex.: presell"
            autoComplete="off"
          />
        </div>
      </div>

      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Antes de publicar:</strong> inclua o domínio desta página na allowlist do
        tracker. Esta tela apenas orienta; não altera a allowlist.
      </p>

      <div className="space-y-2">
        <Label htmlFor="quiz-installer-snippet">Trecho de integração</Label>
        <textarea
          id="quiz-installer-snippet"
          className={cn(textareaClass, "h-32")}
          readOnly
          spellCheck={false}
          value={snippet ?? "Preencha Project ID, Funnel ID e Page ID para gerar o trecho."}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          CTA e jornada são opcionais: use <code className="rounded bg-muted px-1 py-0.5">data-nga-cta</code> nos CTAs
          e <code className="rounded bg-muted px-1 py-0.5">data-nga-journey-link</code> nos links entre domínios.
        </span>
        <Button type="button" onClick={handleCopy} disabled={!snippet}>
          <Copy /> Copiar trecho
        </Button>
      </div>
    </Card>
  );
}
