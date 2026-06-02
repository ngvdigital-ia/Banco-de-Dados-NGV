"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Pencil, Trash2, MonitorPlay, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { EmptyState } from "@/components/ui/empty-state";
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
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
            <Input id="btubeLink" name="btubeLink" placeholder="https://..." defaultValue={vsl?.btubeLink ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (min)</Label>
              <Input id="duration" name="duration" type="number" placeholder="0" defaultValue={vsl?.duration ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceRevealSecond">Pit de Vendas (min)</Label>
              <Input id="priceRevealSecond" name="priceRevealSecond" type="number" placeholder="0" defaultValue={vsl?.priceRevealSecond ?? ""} />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              id="backRedirectActive"
              name="backRedirectActive"
              defaultChecked={vsl?.backRedirectActive}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Back Redirect Ativo</span>
          </label>
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

  function formatMinutes(val: number | null) {
    if (val == null) return <span className="text-muted-foreground/50">—</span>;
    return <span className="tabular-nums">{val} min</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          {vslList.length > 0 && `${vslList.length} VSL${vslList.length !== 1 ? "s" : ""}`}
        </p>
        <VslFormDialog
          projectId={projectId}
          teamMembersList={team}
          trigger={
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Nova VSL
            </Button>
          }
          onSaved={load}
        />
      </div>

      {vslList.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={MonitorPlay}
            title="Nenhuma VSL cadastrada"
            description="Adicione a primeira VSL para esse projeto."
          />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Versão</TableHead>
                <TableHead className="font-semibold text-foreground">Copywriter</TableHead>
                <TableHead className="font-semibold text-foreground">Duração</TableHead>
                <TableHead className="font-semibold text-foreground">Pit de Vendas</TableHead>
                <TableHead className="font-semibold text-foreground">Back Redirect</TableHead>
                <TableHead className="font-semibold text-foreground">Link</TableHead>
                <TableHead className="w-[80px] font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vslList.map((vsl) => (
                <TableRow
                  key={vsl.id}
                  className="transition-colors duration-150 hover:bg-primary/[0.03]"
                >
                  <TableCell>
                    <span className="font-semibold text-foreground">{vsl.version}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vsl.copywriterName ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      {vsl.duration != null && <Clock className="h-3 w-3 shrink-0 text-primary/60" aria-hidden="true" />}
                      {formatMinutes(vsl.duration)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatMinutes(vsl.priceRevealSecond)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={vsl.backRedirectActive ? "success" : "neutral"}>
                      {vsl.backRedirectActive ? "Sim" : "Não"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {vsl.btubeLink ? (
                      <a
                        href={vsl.btubeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir link BTube"
                        className="inline-flex items-center gap-1 text-xs text-primary transition-opacity hover:opacity-70"
                      >
                        <ExternalLink className="h-3 w-3" />
                        BTube
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <VslFormDialog
                        projectId={projectId}
                        vsl={vsl}
                        teamMembersList={team}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar VSL"
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
                        aria-label="Excluir VSL"
                        className="h-7 w-7 text-muted-foreground transition-colors hover:text-danger"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteVsl(vsl.id, projectId);
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
