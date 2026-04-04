"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createAbTest } from "./actions";

export function AbTestFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [variants, setVariants] = useState([
    { name: "Variante A", description: "" },
    { name: "Variante B", description: "" },
  ]);

  function addVariant() {
    setVariants([...variants, { name: `Variante ${String.fromCharCode(65 + variants.length)}`, description: "" }]);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Teste A/B</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Teste</Label>
            <Input name="name" placeholder="Ex: Headline VSL v3 vs v4" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Entidade</Label>
              <Select name="entityType" defaultValue="vsl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vsl">VSL</SelectItem>
                  <SelectItem value="creative">Criativo</SelectItem>
                  <SelectItem value="offer">Oferta</SelectItem>
                  <SelectItem value="headline">Headline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input name="startDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variantes</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="mr-1 h-3 w-3" />Variante
              </Button>
            </div>
            {variants.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={v.name}
                  onChange={(e) => {
                    const updated = [...variants];
                    updated[i].name = e.target.value;
                    setVariants(updated);
                  }}
                  placeholder="Nome"
                  className="w-1/3"
                />
                <Input
                  value={v.description}
                  onChange={(e) => {
                    const updated = [...variants];
                    updated[i].description = e.target.value;
                    setVariants(updated);
                  }}
                  placeholder="Descrição"
                  className="flex-1"
                />
                {variants.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar Teste"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
