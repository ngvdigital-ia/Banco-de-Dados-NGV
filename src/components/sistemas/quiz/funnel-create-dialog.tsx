"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarFunilQuizAction } from "@/app/(dashboard)/sistemas/quiz/actions";
import type { QuizProvisionedProject, QuizTrackerInstallation } from "@/lib/sistemas/quiz/projects-client.mjs";

export type CreatedFunnel = {
  format: "quiz" | "vsl" | "presell";
  data: { project: QuizProvisionedProject; installation: QuizTrackerInstallation };
};

function createErrorMessage(result: { kind: string; reason?: string; code?: string }) {
  if (result.kind === "not_configured") return "O Funnel Analytics não está configurado neste ambiente. Nenhuma criação foi enviada.";
  switch (result.code) {
    case "CONFLICT": return "Já existe um funil com esse identificador gerado. Ajuste o nome e tente novamente.";
    case "UNAUTHORIZED": return "A credencial server-only foi recusada pelo Funnel Analytics.";
    case "PROVISION_INPUT_INVALID": return "Revise o nome, a URL HTTPS e o vínculo opcional com o Banco.";
    case "TIMEOUT": return "O Funnel Analytics excedeu o tempo seguro; confirme a lista antes de tentar novamente.";
    default: return "Não foi possível criar o funil. Nenhum ID foi assumido como criado.";
  }
}

export function FunnelCreateDialog({ provisioningEnabled, onCreated }: { provisioningEnabled: boolean; onCreated: (created: CreatedFunnel) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const format = formData.get("format");
    if (format !== "quiz" && format !== "vsl" && format !== "presell") return;

    setError(null);
    startTransition(async () => {
      const result = await criarFunilQuizAction(formData);
      if (result.kind !== "success") {
        setError(createErrorMessage(result));
        return;
      }
      onCreated({ format, data: result.data });
      form.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" disabled={!provisioningEnabled} className="min-h-11 md:min-h-9" />}>
        <Plus className="size-4" aria-hidden="true" /> Criar funil
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar funil</DialogTitle>
          <DialogDescription>O Banco envia somente nome, URL HTTPS e o vínculo opcional. Project, funnel e page IDs são gerados pelo Funnel Analytics.</DialogDescription>
        </DialogHeader>
        {!provisioningEnabled ? <p className="rounded-md border border-warning/40 bg-warning-muted p-3 text-sm text-muted-foreground">A criação está indisponível no Funnel Analytics. A lista continua apenas para leitura.</p> : null}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="quiz-funnel-name">Nome do funil</Label><Input id="quiz-funnel-name" name="name" required maxLength={120} placeholder="Ex.: Gelatina bariátrica" disabled={isPending || !provisioningEnabled} /></div>
          <div className="space-y-2"><Label htmlFor="quiz-funnel-url">URL HTTPS da página</Label><Input id="quiz-funnel-url" name="finalUrl" type="url" required inputMode="url" placeholder="https://exemplo.com/quiz" disabled={isPending || !provisioningEnabled} /><p className="text-xs text-muted-foreground">Use a URL pública da VSL, presell ou quiz. O domínio é vinculado pelo upstream.</p></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Formato</legend><div className="grid gap-2 sm:grid-cols-3">{(["quiz", "vsl", "presell"] as const).map((format) => <label key={format} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="radio" name="format" value={format} defaultChecked={format === "quiz"} disabled={isPending || !provisioningEnabled} />{format === "quiz" ? "Quiz" : format === "vsl" ? "VSL" : "Presell"}</label>)}</div><p className="text-xs text-muted-foreground">Orientação desta sessão, não é salva nem enviada ao Funnel Analytics.</p></fieldset>
          <div className="space-y-2"><Label htmlFor="quiz-banco-offer-id">Vínculo Banco NGV (opcional)</Label><Input id="quiz-banco-offer-id" name="bancoOfferTrackingId" type="number" min="1" step="1" inputMode="numeric" placeholder="ID da oferta no Banco" disabled={isPending || !provisioningEnabled} /><p className="text-xs text-muted-foreground">Informe apenas se já existir uma oferta no Banco. Deixe vazio para piloto sem vínculo.</p></div>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <DialogFooter><Button type="submit" disabled={isPending || !provisioningEnabled}>{isPending ? "Criando…" : "Criar funil"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
