"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { EmptyState } from "@/components/ui/empty-state";
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

const platformVariant: Record<string, "info" | "warning" | "neutral"> = {
  meta: "info",
  tiktok: "neutral",
  google: "warning",
  kwai: "neutral",
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
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label>Nome da Campanha</Label>
            <Input name="name" defaultValue={campaign?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
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
            <Input name="dailyBudget" type="number" step="0.01" placeholder="0,00" defaultValue={campaign?.dailyBudget ?? ""} />
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          {list.length > 0 && `${list.length} campanha${list.length !== 1 ? "s" : ""}`}
        </p>
        <CampaignFormDialog
          projectId={projectId}
          teamList={team}
          trigger={
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Nova Campanha
            </Button>
          }
          onSaved={load}
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha cadastrada"
            description="Adicione a primeira campanha para esse projeto."
          />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Plataforma</TableHead>
                <TableHead className="font-semibold text-foreground">Objetivo</TableHead>
                <TableHead className="font-semibold text-foreground">Orçamento/dia</TableHead>
                <TableHead className="font-semibold text-foreground">Gestor</TableHead>
                <TableHead className="w-[80px] font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow
                  key={c.id}
                  className="transition-colors duration-150 hover:bg-primary/[0.03]"
                >
                  <TableCell>
                    <span className="font-medium text-foreground">{c.name}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={platformVariant[c.platform] ?? "neutral"}>
                      {platformLabels[c.platform] ?? c.platform}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.objective ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell>
                    {c.dailyBudget ? (
                      <span className="tabular-nums text-sm font-medium text-foreground">
                        R$ {c.dailyBudget}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.managerName ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <CampaignFormDialog
                        projectId={projectId}
                        campaign={c}
                        teamList={team}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar campanha"
                            className="h-7 w-7 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                        onSaved={load}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir campanha"
                        className="h-7 w-7 text-muted-foreground transition-colors hover:text-danger"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteCampaign(c.id, projectId);
                            load();
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
