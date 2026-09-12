"use client";

import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  FunnelCreationForm,
  FunnelInstallationSnippets,
  projectKey,
  type GuidedCreatedFunnel,
} from "./installer-panel";

export function FunnelCreateDialog({ provisioningEnabled }: { provisioningEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<GuidedCreatedFunnel | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setCreated(null);
  }

  function openCreatedFunnel() {
    if (!created) return;
    const projectId = projectKey(created.project);
    if (!projectId) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set("project", projectId);
    query.set("tab", "installer");
    query.delete("funnel");
    setOpen(false);
    setCreated(null);
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" disabled={!provisioningEnabled} className="min-h-11 md:min-h-9" />}>
        <Plus className="size-4" aria-hidden="true" /> Criar funil
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {created ? (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-success" aria-hidden="true" /> Funil criado</DialogTitle>
              <DialogDescription>
                Os identificadores foram gerados automaticamente. Copie o trecho correspondente para cada página e abra o funil para acompanhar a instalação.
              </DialogDescription>
            </DialogHeader>
            <FunnelInstallationSnippets idPrefix="quiz-dialog-page-snippet" pages={created.installationPages} />
            <div className="flex justify-end">
              <Button type="button" onClick={openCreatedFunnel}>Abrir funil criado</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle>Criar funil</DialogTitle>
              <DialogDescription>
                Informe o nome e o caminho das páginas. O Banco gera automaticamente os IDs e um trecho próprio para cada página.
              </DialogDescription>
            </DialogHeader>
            {!provisioningEnabled ? <p className="rounded-md border border-warning/40 bg-warning-muted p-3 text-sm text-muted-foreground">A criação está indisponível no Funnel Analytics. A lista continua apenas para leitura.</p> : null}
            <FunnelCreationForm idPrefix="quiz-funnel-dialog" disabled={!provisioningEnabled} onCreated={setCreated} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
