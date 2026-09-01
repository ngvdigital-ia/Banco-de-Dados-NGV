"use client";

import { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CreatedFunnel } from "./funnel-create-dialog";

function buildSnippet(created: CreatedFunnel) {
  const { project } = created.data;
  const { installation } = created.data;
  return [
    "<script",
    "  defer",
    `  src=\"${installation.trackerUrl}\"`,
    `  data-nga-project-id=\"${installation.attributes.projectId}\"`,
    `  data-nga-funnel-id=\"${installation.attributes.funnelId}\"`,
    `  data-nga-page-id=\"${installation.attributes.pageId}\"`,
    `  data-nga-endpoint=\"${installation.attributes.endpoint}\"`,
    `  data-nga-public-key=\"${project.publicKey}\"`,
    "></script>",
  ].join("\n");
}

export function ProvisionedFunnelPanel({ created }: { created: CreatedFunnel }) {
  const [expanded, setExpanded] = useState(false);
  const snippet = buildSnippet(created);
  const { project } = created.data;
  async function copySnippet() {
    try { await navigator.clipboard.writeText(snippet); toast.success("Tracker copiado."); } catch { toast.error("Não foi possível copiar. Selecione o código manualmente."); }
  }
  return <section className="rounded-lg border border-success/40 bg-success-muted p-5" aria-labelledby="quiz-created-title"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 id="quiz-created-title" className="font-semibold">Funil criado: {project.name}</h2><p className="mt-1 text-sm text-muted-foreground">Siga os quatro passos abaixo para instalar e confirmar o tracker.</p><ol className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><li><b>1. Copiar</b><p className="text-muted-foreground">Copie o tracker gerado.</p></li><li><b>2. Colar</b><p className="text-muted-foreground">Cole antes de <code className="font-mono">&lt;/head&gt;</code>.</p></li><li><b>3. Publicar</b><p className="text-muted-foreground">Publique a página no domínio informado.</p></li><li><b>4. Testar</b><p className="text-muted-foreground">Abra a aba Instalação e confirme a origin.</p></li></ol><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={copySnippet}><Copy className="size-4" aria-hidden="true" /> Copiar tracker</Button><Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Ocultar IDs" : "Ver IDs e tracker"}</Button></div>{expanded ? <div className="mt-4 space-y-3"><dl className="grid gap-2 rounded-md border bg-background/60 p-3 text-xs sm:grid-cols-3"><div><dt className="text-muted-foreground">Project ID</dt><dd className="font-mono">{project.projectId}</dd></div><div><dt className="text-muted-foreground">Funnel ID</dt><dd className="font-mono">{project.funnelId}</dd></div><div><dt className="text-muted-foreground">Page ID</dt><dd className="font-mono">{project.pageId}</dd></div></dl><label className="block text-xs font-medium">Tracker preenchido<textarea readOnly value={snippet} aria-label="Código do tracker gerado" className="mt-1 min-h-48 w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed" /></label></div> : null}</div></div></section>;
}
