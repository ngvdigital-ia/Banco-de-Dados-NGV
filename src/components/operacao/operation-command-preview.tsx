"use client";

import { useState } from "react";
import { AlertTriangle, Eye, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { actionLabel, createOperationCommandPreview } from "@/lib/operacao/command-preview.mjs";
import { OPERATION_ACTIONS } from "@/lib/operacao/command-contract.mjs";
import type { OperationOffer } from "@/lib/operacao/schema";

const ACTION_OPTIONS = OPERATION_ACTIONS.map((value) => ({ value, label: actionLabel(value) }));

export function OperationCommandPreview({ offers, generatedAt }: { offers: OperationOffer[]; generatedAt: string }) {
  const [selectedOfferId, setSelectedOfferId] = useState(offers[0]!.offer_id);
  const [action, setAction] = useState<(typeof OPERATION_ACTIONS)[number]>("consult");
  const selectedOffer = offers.find((offer) => offer.offer_id === selectedOfferId) ?? offers[0]!;
  const preview = createOperationCommandPreview({ offer: selectedOffer, action, generatedAt });
  const isConsult = preview.classification === "CONSULT";

  return (
    <section aria-labelledby="operation-command-preview" className="border-t pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-primary">Comandos tipados</p>
            <StatusBadge variant="neutral" className="gap-1.5"><Eye className="size-3" aria-hidden="true" />Preview local</StatusBadge>
          </div>
          <h2 id="operation-command-preview" className="mt-1 text-xl font-semibold tracking-tight">Preview local de comando</h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            Nenhuma ação será enviada. A seleção apenas monta e valida um rascunho local determinístico.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 sm:w-64">
          <span className="block text-xs font-medium text-muted-foreground">Oferta</span>
          <select value={selectedOffer.offer_id} onChange={(event) => setSelectedOfferId(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {offers.map((offer) => <option key={offer.offer_id} value={offer.offer_id}>{offer.display_name} · {offer.offer_id}</option>)}
          </select>
        </label>
        <label className="min-w-0 sm:w-56">
          <span className="block text-xs font-medium text-muted-foreground">Intenção</span>
          <select value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
        <div className="rounded-md border bg-card p-3"><p className="text-[11px] text-muted-foreground">Oferta selecionada</p><p className="mt-1 truncate font-mono text-xs" title={selectedOffer.offer_id}>{selectedOffer.display_name} · {selectedOffer.offer_id}</p></div>
        <div className="rounded-md border bg-card p-3"><p className="text-[11px] text-muted-foreground">Ação / classe</p><p className="mt-1 text-sm font-medium">{actionLabel(action)} · {preview.classification}</p></div>
        <div className="rounded-md border bg-card p-3"><p className="text-[11px] text-muted-foreground">Alvo ClickUp</p><p className="mt-1 truncate font-mono text-xs" title={preview.target}>{preview.target}</p></div>
        <div className={cn("rounded-md border p-3", preview.valid ? "bg-info-muted" : "bg-danger-muted")}>
          <p className="text-[11px] text-muted-foreground">Contrato local</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">{preview.valid ? <ShieldCheck className="size-4 text-info" aria-hidden="true" /> : <AlertTriangle className="size-4 text-danger" aria-hidden="true" />}{preview.valid ? "Contrato válido, envio indisponível" : "Bloqueado"}</p>
        </div>
      </div>

      <div className={cn("mt-3 border-l-[3px] p-3 text-sm", isConsult ? "border-l-info bg-info-muted" : "border-l-danger bg-danger-muted")}>
        <p className="font-medium">{preview.reason}</p>
        {preview.issues.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{preview.issues.map((issue: { path: string; message: string }) => <li key={`${issue.path}:${issue.message}`}><span className="font-mono">{issue.path}</span> · {issue.message}</li>)}</ul>}
      </div>
    </section>
  );
}
