"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Trash2, ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
        <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
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
    const price = prompt("Preço (ex: 47.00):") ?? "0";
    let contentType: string | null = null;
    let textLength: string | null = null;
    const ctChoice = prompt("Tipo de conteúdo: 1 = Vídeo, 2 = Texto (digite 1 ou 2):");
    if (ctChoice === "1") {
      contentType = "video";
    } else if (ctChoice === "2") {
      contentType = "texto";
      const tlChoice = prompt("Tamanho do texto: 1 = Longo, 2 = Curto (digite 1 ou 2):");
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{funnel.name}</CardTitle>
          <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
            {funnel.salesPageUrl && <span>Vendas: {funnel.salesPageUrl}</span>}
            {funnel.checkoutUrl && <span>Checkout: {funnel.checkoutUrl}</span>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => {
          if (confirm("Deletar funil e todos os nodes/bumps?")) {
            startTransition(async () => {
              await deleteFunnel(funnel.id, funnel.projectId);
              onDelete();
            });
          }
        }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Bumps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Order Bumps</h4>
            <Button variant="outline" size="sm" onClick={addBump}>
              <Plus className="mr-1 h-3 w-3" />Bump
            </Button>
          </div>
          {bumps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum order bump</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bumps.map((b) => (
                <Badge key={b.id} variant="secondary" className="flex items-center gap-1">
                  {b.name} - R$ {b.price}
                  <button onClick={() => startTransition(async () => { await deleteOrderBump(b.id); load(); })}
                    className="ml-1 hover:text-destructive">x</button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Funnel Nodes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Fluxo do Funil</h4>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => addNode("upsell")}>
                <Plus className="mr-1 h-3 w-3" />Upsell
              </Button>
              <Button variant="outline" size="sm" onClick={() => addNode("downsell")}>
                <Plus className="mr-1 h-3 w-3" />Downsell
              </Button>
            </div>
          </div>
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum node no funil</p>
          ) : (
            <div className="space-y-2">
              {nodes.map((node, i) => (
                <div key={node.id} className="flex items-center gap-2">
                  {i > 0 && <ArrowDown className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex items-center gap-2 rounded-md border p-2 flex-1">
                    <Badge variant={node.nodeType === "upsell" ? "default" : node.nodeType === "downsell" ? "secondary" : "outline"}>
                      {nodeTypeLabels[node.nodeType]}
                    </Badge>
                    <span className="font-medium">{node.offerName}</span>
                    <span className="text-sm text-muted-foreground">R$ {node.price}</span>
                    {node.contentType && (
                      <Badge variant="outline">
                        {node.contentType === "video" ? "Vídeo" : `Texto (${node.textLength === "longo" ? "Longo" : "Curto"})`}
                      </Badge>
                    )}
                    {node.url && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{node.url}</span>}
                    <button onClick={() => startTransition(async () => { await deleteFunnelNode(node.id); load(); })}
                      className="ml-auto hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
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
      <div className="flex justify-end">
        <FunnelFormDialog projectId={projectId} trigger={
          <Button><Plus className="mr-2 h-4 w-4" />Novo Funil</Button>
        } onSaved={load} />
      </div>
      {funnelList.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum funil cadastrado</p>
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
