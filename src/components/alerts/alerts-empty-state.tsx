"use client";

import { BellRing } from "lucide-react";
import { AlertFormDialog } from "./alert-form-dialog";

export function AlertsEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-12 text-center"
      role="status"
      aria-label="Nenhum alerta configurado"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <BellRing className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">Nenhum alerta configurado</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Crie alertas para monitorar ROAS, gasto e reembolso e receber notificações no Slack.
        </p>
      </div>
      <div className="mt-1">
        <AlertFormDialog />
      </div>
    </div>
  );
}
