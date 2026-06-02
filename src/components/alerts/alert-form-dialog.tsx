"use client";

import { useState, useTransition } from "react";
import { BellRing, Pencil, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALERT_METRICS,
  ALERT_OPERATORS,
  ALERT_TARGETS,
  alertMetricDef,
  alertTargetByEntity,
} from "@/lib/alerts-config";
import { createAlert, updateAlert } from "@/app/(dashboard)/alertas/actions";
import type { AlertWithStatus } from "@/app/(dashboard)/alertas/actions";

type Props = {
  alert?: AlertWithStatus;
  trigger?: React.ReactNode;
};

export function AlertFormDialog({ alert, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!alert;
  const defaultMetric = alert?.metric ?? "roas";
  const defaultHint = alertMetricDef(defaultMetric)?.hint ?? "";
  const defaultTarget = alert
    ? (alertTargetByEntity(alert.entityType, alert.entityId)?.value ?? "dashboard:0")
    : "dashboard:0";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateAlert(formData);
        } else {
          await createAlert(formData);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  const triggerEl = trigger ?? (
    isEditing ? (
      <Button variant="ghost" size="icon" aria-label="Editar alerta">
        <Pencil className="h-4 w-4" />
      </Button>
    ) : (
      <Button>
        <BellRing className="h-4 w-4 mr-2" />
        Novo alerta
      </Button>
    )
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerEl as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <BellRing className="h-4 w-4" />
            </div>
            <DialogTitle>
              {isEditing ? "Editar alerta" : "Novo alerta"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Separator className="opacity-50" />

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {isEditing && (
            <input type="hidden" name="id" value={alert.id} />
          )}

          {/* Nome */}
          <FormField label="Nome">
            <Input
              name="name"
              defaultValue={alert?.name}
              placeholder="Ex: ROAS abaixo de 1.5x"
              required
            />
          </FormField>

          {/* Métrica */}
          <FormField label="Métrica">
            <Select name="metric" defaultValue={defaultMetric}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a métrica" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-snug">
              {defaultHint}
            </p>
          </FormField>

          {/* Operador */}
          <FormField label="Condição">
            <Select name="operator" defaultValue={alert?.operator ?? "lt"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a condição" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_OPERATORS.map((op) => (
                  <SelectItem key={op.key} value={op.key}>
                    {op.label} ({op.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Threshold */}
          <FormField label="Valor de referência">
            <Input
              name="threshold"
              type="number"
              step="0.01"
              defaultValue={alert?.threshold}
              placeholder="Ex: 1.5"
              required
            />
          </FormField>

          {/* Alvo */}
          <FormField label="Alvo">
            <Select name="target" defaultValue={defaultTarget}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o alvo" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-muted px-3 py-2.5 text-xs text-danger-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Separator className="opacity-50" />

          <div className="flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending} className="min-w-[80px]">
              {isPending ? "Salvando…" : isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
