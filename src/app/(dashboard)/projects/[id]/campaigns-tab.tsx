"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign } from "./campaigns-actions";
import { getTeamMembers } from "../../team/actions";

type Campaign = Awaited<ReturnType<typeof getCampaigns>>[number];
type TeamMember = Awaited<ReturnType<typeof getTeamMembers>>[number];

const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  tiktok: "TikTok",
  google: "Google",
  kwai: "Kwai",
};

function CampaignFormDialog({
  projectId, campaign, teamList, trigger, onSaved,
}: {
  projectId: number;
  campaign?: Campaign;
  teamList: TeamMember[];
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mgrVal = fd.get("managerId") as string;

    const data = {
      projectId,
      platform: fd.get("platform") as "meta" | "tiktok" | "google" | "kwai",
      name: fd.get("name") as string,
      objective: (fd.get("objective") as string) || null,
      dailyBudget: (fd.get("dailyBudget") as string) || null,
      managerId: mgrVal && mgrVal !== "none" ? Number(mgrVal) : null,
      status: "ativo",
    };

    startTransition(async () => {
      if (campaign) {
        await updateCampaign(campaign.id, data);
      } else {
        await createCampaign(data);
      }
      setOpen(false);
      onSaved();
    });
  }

  const managers = teamList.filter((m) => m.role === "gestor_trafego" || m.role === "admin");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Campanha</Label>
            <Input name="name" defaultValue={campaign?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select name="platform" defaultValue={campaign?.platform ?? "meta"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(platformLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gestor de Tráfego</Label>
              <Select name="managerId" defaultValue={campaign?.managerId?.toString() ?? "none"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input name="objective" placeholder="Conversão, alcance..." defaultValue={campaign?.objective ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Orçamento Diário (R$)</Label>
            <Input name="dailyBudget" type="number" step="0.01" defaultValue={campaign?.dailyBudget ?? ""} />
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

export function CampaignsTab({ projectId }: { projectId: number }) {
  const [list, setList] = useState<Campaign[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const [c, t] = await Promise.all([getCampaigns(projectId), getTeamMembers()]);
      setList(c);
      setTeam(t);
    });
  }

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CampaignFormDialog projectId={projectId} teamList={team} trigger={
          <Button><Plus className="mr-2 h-4 w-4" />Nova Campanha</Button>
        } onSaved={load} />
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhuma campanha cadastrada</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Orçamento/dia</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{platformLabels[c.platform] ?? c.platform}</Badge></TableCell>
                  <TableCell>{c.objective ?? "-"}</TableCell>
                  <TableCell>{c.dailyBudget ? `R$ ${c.dailyBudget}` : "-"}</TableCell>
                  <TableCell>{c.managerName ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CampaignFormDialog projectId={projectId} campaign={c} teamList={team} trigger={
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      } onSaved={load} />
                      <Button variant="ghost" size="icon" onClick={() => {
                        startTransition(async () => { await deleteCampaign(c.id, projectId); load(); });
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
