"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2, ArrowDown, GitBranch, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import {
  getFunnels, getFunnelNodes, getOrderBumps,
  createFunnel, deleteFunnel,
  createFunnelNode, deleteFunnelNode,
  createOrderBump, deleteOrderBump,
  type FunnelFormData,
} from "./funnel-actions";

type Funnel = Awaited<ReturnType<typeof getFunnels>>[number];
type FunnelNode = Awaited<ReturnType<typeof getFunnelNodes>>[number];
type OrderBump = Awaited<ReturnType<typeof getOrderBumps>>[number];

const nodeTypeLabels: Record<string, string> = {
  checkout: "Checkout",
  upsell: "Upsell",
  downsell: "Downsell",
};

type StatusVariant = "success" | "danger" | "info" | "warning" | "neutral";

const nodeTypeVariant: Record<string, StatusVariant> = {
  checkout: "info",
  upsell: "success",
  downsell: "warning",
};

function FunnelFormDialog({
  projectId, trigger, onSaved,
}: {
  projectId: number;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: FunnelFormData = {
      projectId,
      name: fd.get("name") as string,
      salesPageUrl: (fd.get("salesPageUrl") as string) || null,
      checkoutUrl: (fd.get("checkoutUrl") as string) || null,
    };
    startTransition(async () => {
      await createFunnel(data);
      setOpen(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Funil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label>Nome do Funil</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <Label>URL Página de Vendas</Label>
            <Input name="salesPageUrl" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>URL Checkout</Label>
            <Input name="checkoutUrl" placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FunnelDetail({ funnel, onDelete }: { funnel: Funnel; onDelete: () => void }) {
  const [nodes, setNodes] = useState<FunnelNode[]>([]);
  const [bumps, setBumps] = useState<OrderBump[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const [n, b] = await Promise.all([getFunnelNodes(funnel.id), getOrderBumps(funnel.id)]);
      setNodes(n);
      setBumps(b);
    });
  }

  useEffect(() => { load(); }, [funnel.id]);

  function addNode(type: "checkout" | "upsell" | "downsell") {
    const name = prompt(`Nome do ${nodeTypeLabels[type]}:`);
    if (!name) return;
    const price = prompt("Preço (ex: 47.00):");
    if (price === null) return;
    let contentType: string | null = null;
    let textLength: string | null = null;
    const ctChoice = prompt("Tipo de conteúdo: 1 = Vídeo, 2 = Texto (digite 1 ou 2):");
    if (ctChoice === null) return;
    if (ctChoice === "1") {
      contentType = "video";
    } else if (ctChoice === "2") {
      contentType = "texto";
      const tlChoice = prompt("Tamanho do texto: 1 = Longo, 2 = Curto (digite 1 ou 2):");
      if (tlChoice === null) return;
      textLength = tlChoice === "1" ? "longo" : "curto";
    }
    startTransition(async () => {
      await createFunnelNode({
        funnelId: funnel.id,
        parentNodeId: null,
        nodeType: type,
        offerName: name,
        price,
        url: null,
        acceptDestinationId: null,
        declineDestinationId: null,
        contentType,
        textLength,
        position: nodes.length,
      });
      load();
    });
  }

  function addBump() {
    const name = prompt("Nome do Order Bump:");
    if (!name) return;
    const price = prompt("Preço (ex: 9.90):") ?? "0";
    startTransition(async () => {
      await createOrderBump({ funnelId: funnel.id, name, price, active: true });
      load();
    });
  }

  return (
    <Card className="overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Accent bar indigo no topo */}
      <div className="h-0.5 w-full bg-primary/30" aria-hidden="true" />

      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold">{funnel.name}</CardTitle>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {funnel.salesPageUrl && (
              <a
                href={funnel.salesPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-primary"
              >
                <ChevronRight className="h-3 w-3 text-primary/60" aria-hidden="true" />
                Página de vendas
              </a>
            )}
            {funnel.checkoutUrl && (
              <a
                href={funnel.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-primary"
              >
                <ChevronRight className="h-3 w-3 text-primary/60" aria-hidden="true" />
                Checkout
              </a>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Excluir funil"
          className="h-7 w-7 shrink-0 text-muted-foreground transition-colors hover:text-danger"
          onClick={() => {
            if (confirm("Deletar funil e todos os nodes/bumps?")) {
              startTransition(async () => {
                await deleteFunnel(funnel.id, funnel.projectId);
                onDelete();
              });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <Separator />

      <CardContent className="space-y-5 pt-4">
        {/* Order Bumps */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Bumps
            </h4>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={addBump}
            >
              <Plus className="h-3 w-3" />
              Bump
            </Button>
          </div>
          {bumps.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Nenhum order bump</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bumps.map((b) => (
                <div
                  key={b.id}
                  className="group flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                >
                  <span className="tabular-nums">{b.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="tabular-nums text-primary">R$ {b.price}</span>
                  <button
                    type="button"
                    aria-label={`Remover bump ${b.name}`}
                    onClick={() => startTransition(async () => { await deleteOrderBump(b.id); load(); })}
                    className="ml-0.5 rounded text-muted-foreground/60 transition-colors hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Funnel Nodes */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fluxo do Funil
            </h4>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => addNode("upsell")}
              >
                <Plus className="h-3 w-3" />
                Upsell
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => addNode("downsell")}
              >
                <Plus className="h-3 w-3" />
                Downsell
              </Button>
            </div>
          </div>

          {nodes.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Nenhum node no funil</p>
          ) : (
            <div className="space-y-1.5">
              {nodes.map((node, i) => (
                <div key={node.id} className="flex flex-col items-start gap-1">
                  {i > 0 && (
                    <div className="ml-3 flex items-center">
                      <ArrowDown className="h-3.5 w-3.5 text-primary/40" aria-hidden="true" />
                    </div>
                  )}
                  <div className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors duration-150 hover:border-primary/30 hover:bg-primary/[0.02]">
                    <StatusBadge variant={nodeTypeVariant[node.nodeType] ?? "neutral"}>
                      {nodeTypeLabels[node.nodeType]}
                    </StatusBadge>
                    <span className="flex-1 text-sm font-medium text-foreground">{node.offerName}</span>
                    <span className="tabular-nums text-sm font-semibold text-primary">
                      R$ {node.price}
                    </span>
                    {node.contentType && (
                      <span className="text-xs text-muted-foreground">
                        {node.contentType === "video"
                          ? "Vídeo"
                          : `Texto (${node.textLength === "longo" ? "Longo" : "Curto"})`}
                      </span>
                    )}
                    {node.url && (
                      <span className="max-w-[160px] truncate text-xs text-muted-foreground">
                        {node.url}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remover node ${node.offerName}`}
                      onClick={() =>
                        startTransition(async () => { await deleteFunnelNode(node.id); load(); })
                      }
                      className="ml-auto rounded text-muted-foreground/40 transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FunnelTab({ projectId }: { projectId: number }) {
  const [funnelList, setFunnelList] = useState<Funnel[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const f = await getFunnels(projectId);
      setFunnelList(f);
    });
  }

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          {funnelList.length > 0 && `${funnelList.length} funil${funnelList.length !== 1 ? "s" : ""}`}
        </p>
        <FunnelFormDialog
          projectId={projectId}
          trigger={
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Novo Funil
            </Button>
          }
          onSaved={load}
        />
      </div>

      {funnelList.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={GitBranch}
            title="Nenhum funil cadastrado"
            description="Adicione o primeiro funil para estruturar o fluxo de vendas."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {funnelList.map((f) => (
            <FunnelDetail key={f.id} funnel={f} onDelete={load} />
          ))}
        </div>
      )}
    </div>
  );
}
