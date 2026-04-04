"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createMetricsSnapshot } from "./actions";

export function MetricsForm({
  projects,
}: {
  projects: { id: number; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    const data = {
      date: fd.get("date") as string,
      entityType: "project",
      entityId: Number(fd.get("projectId")),
      source: "manual" as const,
      impressions: fd.get("impressions") ? Number(fd.get("impressions")) : null,
      clicks: fd.get("clicks") ? Number(fd.get("clicks")) : null,
      spend: (fd.get("spend") as string) || null,
      pageVisits: fd.get("pageVisits") ? Number(fd.get("pageVisits")) : null,
      playRate: (fd.get("playRate") as string) || null,
      buttonClickRate: (fd.get("buttonClickRate") as string) || null,
      checkoutVisits: fd.get("checkoutVisits") ? Number(fd.get("checkoutVisits")) : null,
      conversionRate: (fd.get("conversionRate") as string) || null,
      avgTicket: (fd.get("avgTicket") as string) || null,
      revenue: (fd.get("revenue") as string) || null,
      cpa: (fd.get("cpa") as string) || null,
      roas: (fd.get("roas") as string) || null,
    };

    startTransition(async () => {
      await createMetricsSnapshot(data);
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select name="projectId" required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Tráfego</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Impressões</Label>
            <Input name="impressions" type="number" placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Cliques</Label>
            <Input name="clicks" type="number" placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Gasto (R$)</Label>
            <Input name="spend" type="number" step="0.01" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Página de Vendas</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Visitas na Página</Label>
            <Input name="pageVisits" type="number" placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Play Rate (%)</Label>
            <Input name="playRate" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Clique no Botão (%)</Label>
            <Input name="buttonClickRate" type="number" step="0.01" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Checkout</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Visitas no Checkout</Label>
            <Input name="checkoutVisits" type="number" placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Conversão (%)</Label>
            <Input name="conversionRate" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Ticket Médio (R$)</Label>
            <Input name="avgTicket" type="number" step="0.01" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Consolidados</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Receita (R$)</Label>
            <Input name="revenue" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>CPA (R$)</Label>
            <Input name="cpa" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>ROAS</Label>
            <Input name="roas" type="number" step="0.01" placeholder="0.00" />
          </div>
        </div>
      </div>

      {success && (
        <p className="text-sm text-green-600 font-medium">Métricas salvas com sucesso!</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar Métricas"}
      </Button>
    </form>
  );
}
