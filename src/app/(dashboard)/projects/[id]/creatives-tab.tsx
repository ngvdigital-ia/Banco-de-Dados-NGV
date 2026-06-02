"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
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
import { getCreatives, createCreative, updateCreative, deleteCreative } from "./creatives-actions";
import { getTeamMembers } from "../../team/actions";

type Creative = Awaited<ReturnType<typeof getCreatives>>[number];
type TeamMember = Awaited<ReturnType<typeof getTeamMembers>>[number];

const formatLabels: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masculino",
  ugc_fem: "UGC Feminino",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
};

const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  tiktok: "TikTok",
  google: "Google",
  kwai: "Kwai",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  validou: "Validou",
  nao_validou: "Não Validou",
  escalou: "Escalou",
  nao_escalou: "Não Escalou",
};

type StatusVariant = "success" | "danger" | "info" | "warning" | "neutral";

const creativeStatusVariant: Record<string, StatusVariant> = {
  rascunho: "neutral",
  validou: "success",
  nao_validou: "danger",
  escalou: "success",
  nao_escalou: "danger",
};

function CreativeFormDialog({
  projectId, creative, teamList, trigger, onSaved,
}: {
  projectId: number;
  creative?: Creative;
  teamList: TeamMember[];
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cwVal = fd.get("copywriterId") as string;
    const edVal = fd.get("editorId") as string;

    const data = {
      projectId,
      platform: fd.get("platform") as "meta" | "tiktok" | "google" | "kwai",
      format: fd.get("format") as "especialista" | "ugc_masc" | "ugc_fem" | "famoso" | "youtuber" | "autoridade" | "podcast",
      copywriterId: cwVal && cwVal !== "none" ? Number(cwVal) : null,
      editorId: edVal && edVal !== "none" ? Number(edVal) : null,
      videoLink: (fd.get("videoLink") as string) || null,
      status: fd.get("status") as "rascunho" | "validou" | "nao_validou" | "escalou" | "nao_escalou",
    };

    startTransition(async () => {
      if (creative) {
        await updateCreative(creative.id, data);
      } else {
        await createCreative(data);
      }
      setOpen(false);
      onSaved();
    });
  }

  const copywriters = teamList.filter((m) => m.role === "copywriter" || m.role === "admin");
  const editors = teamList.filter((m) => m.role === "editor" || m.role === "admin");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{creative ? "Editar Criativo" : "Novo Criativo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select name="platform" defaultValue={creative?.platform ?? "meta"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(platformLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select name="format" defaultValue={creative?.format ?? "especialista"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(formatLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Copywriter</Label>
              <Select name="copywriterId" defaultValue={creative?.copywriterId?.toString() ?? "none"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {copywriters.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Editor</Label>
              <Select name="editorId" defaultValue={creative?.editorId?.toString() ?? "none"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {editors.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Link do Vídeo</Label>
            <Input name="videoLink" placeholder="https://..." defaultValue={creative?.videoLink ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" defaultValue={creative?.status ?? "rascunho"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export function CreativesTab({ projectId }: { projectId: number }) {
  const [list, setList] = useState<Creative[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const [c, t] = await Promise.all([getCreatives(projectId), getTeamMembers()]);
      setList(c);
      setTeam(t);
    });
  }

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          {list.length > 0 && `${list.length} criativo${list.length !== 1 ? "s" : ""}`}
        </p>
        <CreativeFormDialog
          projectId={projectId}
          teamList={team}
          trigger={
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Novo Criativo
            </Button>
          }
          onSaved={load}
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={Layers}
            title="Nenhum criativo cadastrado"
            description="Adicione o primeiro criativo para esse projeto."
          />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Formato</TableHead>
                <TableHead className="font-semibold text-foreground">Plataforma</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Criado em</TableHead>
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
                    <span className="font-medium text-foreground">
                      {formatLabels[c.format] ?? c.format}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {platformLabels[c.platform] ?? c.platform}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={creativeStatusVariant[c.status] ?? "neutral"}>
                      {statusLabels[c.status] ?? c.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleDateString("pt-BR")
                      : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <CreativeFormDialog
                        projectId={projectId}
                        creative={c}
                        teamList={team}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar criativo"
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
                        aria-label="Excluir criativo"
                        className="h-7 w-7 text-muted-foreground transition-colors hover:text-danger"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteCreative(c.id, projectId);
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
