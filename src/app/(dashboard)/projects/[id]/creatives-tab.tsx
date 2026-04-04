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
  publicado: "Publicado",
  pausado: "Pausado",
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
      copyScript: (fd.get("copyScript") as string) || null,
      copywriterId: cwVal && cwVal !== "none" ? Number(cwVal) : null,
      editorId: edVal && edVal !== "none" ? Number(edVal) : null,
      videoLink: (fd.get("videoLink") as string) || null,
      status: fd.get("status") as "rascunho" | "publicado" | "pausado",
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
            <Label>Copy / Roteiro</Label>
            <textarea name="copyScript" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={creative?.copyScript ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Link do Vídeo</Label>
            <Input name="videoLink" defaultValue={creative?.videoLink ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" defaultValue={creative?.status ?? "rascunho"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
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
      <div className="flex justify-end">
        <CreativeFormDialog projectId={projectId} teamList={team} trigger={
          <Button><Plus className="mr-2 h-4 w-4" />Novo Criativo</Button>
        } onSaved={load} />
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum criativo cadastrado</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formato</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{formatLabels[c.format] ?? c.format}</TableCell>
                  <TableCell>{platformLabels[c.platform] ?? c.platform}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabels[c.status] ?? c.status}</Badge></TableCell>
                  <TableCell>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CreativeFormDialog projectId={projectId} creative={c} teamList={team} trigger={
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      } onSaved={load} />
                      <Button variant="ghost" size="icon" onClick={() => {
                        startTransition(async () => { await deleteCreative(c.id, projectId); load(); });
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
