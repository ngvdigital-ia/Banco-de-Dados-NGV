"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getVsls, createVsl, updateVsl, deleteVsl } from "./vsls-actions";
import { getTeamMembers } from "../../team/actions";

type Vsl = Awaited<ReturnType<typeof getVsls>>[number];
type TeamMember = Awaited<ReturnType<typeof getTeamMembers>>[number];

function VslFormDialog({
  projectId,
  vsl,
  teamMembersList,
  trigger,
  onSaved,
}: {
  projectId: number;
  vsl?: Vsl;
  teamMembersList: TeamMember[];
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const copywriterVal = fd.get("copywriterId") as string;

    const data = {
      projectId,
      version: fd.get("version") as string,
      copywriterId: copywriterVal && copywriterVal !== "none" ? Number(copywriterVal) : null,
      btubeLink: (fd.get("btubeLink") as string) || null,
      duration: fd.get("duration") ? Number(fd.get("duration")) : null,
      priceRevealSecond: fd.get("priceRevealSecond") ? Number(fd.get("priceRevealSecond")) : null,
      buttonAppearSecond: fd.get("buttonAppearSecond") ? Number(fd.get("buttonAppearSecond")) : null,
      backRedirectActive: fd.get("backRedirectActive") === "on",
      status: "ativo",
    };

    startTransition(async () => {
      if (vsl) {
        await updateVsl(vsl.id, data);
      } else {
        await createVsl(data);
      }
      setOpen(false);
      onSaved();
    });
  }

  const copywriters = teamMembersList.filter((m) => m.role === "copywriter" || m.role === "admin");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vsl ? "Editar VSL" : "Nova VSL"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version">Versão</Label>
            <Input id="version" name="version" placeholder="v1, v2..." defaultValue={vsl?.version} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="copywriterId">Copywriter</Label>
            <Select name="copywriterId" defaultValue={vsl?.copywriterId?.toString() ?? "none"}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {copywriters.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="btubeLink">Link BTube</Label>
            <Input id="btubeLink" name="btubeLink" defaultValue={vsl?.btubeLink ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (seg)</Label>
              <Input id="duration" name="duration" type="number" defaultValue={vsl?.duration ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceRevealSecond">Seg. Preço</Label>
              <Input id="priceRevealSecond" name="priceRevealSecond" type="number" defaultValue={vsl?.priceRevealSecond ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buttonAppearSecond">Seg. Botão</Label>
              <Input id="buttonAppearSecond" name="buttonAppearSecond" type="number" defaultValue={vsl?.buttonAppearSecond ?? ""} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="backRedirectActive" name="backRedirectActive" defaultChecked={vsl?.backRedirectActive} />
            <Label htmlFor="backRedirectActive">Back Redirect Ativo</Label>
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

export function VslsTab({ projectId }: { projectId: number }) {
  const [vslList, setVslList] = useState<Vsl[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const [v, t] = await Promise.all([getVsls(projectId), getTeamMembers()]);
      setVslList(v);
      setTeam(t);
    });
  }

  useEffect(() => { load(); }, [projectId]);

  function formatSeconds(sec: number | null) {
    if (sec == null) return "-";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <VslFormDialog projectId={projectId} teamMembersList={team} trigger={
          <Button><Plus className="mr-2 h-4 w-4" />Nova VSL</Button>
        } onSaved={load} />
      </div>
      {vslList.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhuma VSL cadastrada</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Copywriter</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Seg. Preço</TableHead>
                <TableHead>Seg. Botão</TableHead>
                <TableHead>Back Redirect</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vslList.map((vsl) => (
                <TableRow key={vsl.id}>
                  <TableCell className="font-medium">{vsl.version}</TableCell>
                  <TableCell>{vsl.copywriterName ?? "-"}</TableCell>
                  <TableCell>{formatSeconds(vsl.duration)}</TableCell>
                  <TableCell>{formatSeconds(vsl.priceRevealSecond)}</TableCell>
                  <TableCell>{formatSeconds(vsl.buttonAppearSecond)}</TableCell>
                  <TableCell>
                    <Badge variant={vsl.backRedirectActive ? "default" : "secondary"}>
                      {vsl.backRedirectActive ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <VslFormDialog projectId={projectId} vsl={vsl} teamMembersList={team} trigger={
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      } onSaved={load} />
                      <Button variant="ghost" size="icon" onClick={() => {
                        startTransition(async () => { await deleteVsl(vsl.id, projectId); load(); });
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
