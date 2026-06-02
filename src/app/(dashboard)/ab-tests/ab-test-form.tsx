"use client";

import { useState, useTransition } from "react";
import { Plus, X, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createAbTest } from "./actions";
import { cn } from "@/lib/utils";

const VARIANT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function AbTestFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [variants, setVariants] = useState([
    { name: "Variante A", description: "" },
    { name: "Variante B", description: "" },
  ]);

  function addVariant() {
    setVariants([
      ...variants,
      { name: `Variante ${VARIANT_LETTERS[variants.length] ?? variants.length + 1}`, description: "" },
    ]);
  }

  function removeVariant(index: number) {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      await createAbTest({
        name: fd.get("name") as string,
        entityType: fd.get("entityType") as string,
        startDate: fd.get("startDate") as string,
        variants,
      });
      setOpen(false);
      setVariants([
        { name: "Variante A", description: "" },
        { name: "Variante B", description: "" },
      ]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <FlaskConical className="h-4 w-4" />
            </div>
            <DialogTitle>Novo Teste A/B</DialogTitle>
          </div>
        </DialogHeader>

        <Separator className="opacity-50" />

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Nome do teste */}
          <FormField label="Nome do Teste">
            <Input
              name="name"
              placeholder="Ex: Headline VSL v3 vs v4"
              required
            />
          </FormField>

          {/* Grid: Tipo + Data */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de Entidade">
              <Select name="entityType" defaultValue="vsl">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vsl">VSL</SelectItem>
                  <SelectItem value="creative">Criativo</SelectItem>
                  <SelectItem value="offer">Oferta</SelectItem>
                  <SelectItem value="headline">Headline</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Data de Início">
              <Input
                name="startDate"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </FormField>
          </div>

          {/* Variantes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Variantes
                <span className="tabular-nums ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/12 px-1.5 text-[10px] font-semibold text-primary">
                  {variants.length}
                </span>
              </Label>
              <button
                type="button"
                onClick={addVariant}
                className="group flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/6 hover:border-primary/60 transition-all duration-150"
              >
                <Plus className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                Variante
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors duration-150",
                    "hover:bg-muted/40",
                  )}
                >
                  <span className="tabular-nums w-5 shrink-0 text-center text-xs font-bold text-primary/70">
                    {VARIANT_LETTERS[i] ?? i + 1}
                  </span>
                  <Input
                    value={v.name}
                    onChange={(e) => {
                      const updated = [...variants];
                      updated[i].name = e.target.value;
                      setVariants(updated);
                    }}
                    placeholder="Nome"
                    className="h-8 w-28 shrink-0 text-xs"
                  />
                  <Input
                    value={v.description}
                    onChange={(e) => {
                      const updated = [...variants];
                      updated[i].description = e.target.value;
                      setVariants(updated);
                    }}
                    placeholder="Descrição (opcional)"
                    className="h-8 flex-1 text-xs"
                  />
                  {variants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      aria-label="Remover variante"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:text-danger hover:bg-danger/8 transition-colors duration-150 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[100px]">
              {isPending ? "Criando…" : "Criar Teste"}
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
