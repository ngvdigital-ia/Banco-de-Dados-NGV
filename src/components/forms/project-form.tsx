"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
import {
  createProject,
  updateProject,
  type ProjectFormData,
} from "@/app/(dashboard)/projects/actions";

const statusLabels: Record<string, string> = {
  escalou: "Escalou",
  nao_escalou: "Não Escalou",
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

const nicheOptions = [
  "Emagrecimento",
  "Sexualidade (Homem)",
  "Sexualidade (Mulher)",
  "Investimentos",
  "Relacionamento (Homem)",
  "Relacionamento (Mulher)",
  "Próstata",
  "Disfunção Erétil",
  "Renda Extra",
  "Outro (digitar)",
];

const languageOptions = [
  "Português",
  "Inglês",
  "Espanhol",
  "Alemão",
  "Francês",
  "Italiano",
  "Outro",
];

const typeOptions = [
  { value: "vsl", label: "VSL" },
  { value: "tsl", label: "TSL" },
];

type Project = {
  id: number;
  name: string;
  type: "vsl" | "tsl";
  niche: string;
  language: string;
  status: "escalou" | "nao_escalou" | "em_teste" | "rodando" | "pausado";
  scaleStartDate: Date | null;
  scaleEndDate: Date | null;
};

export function ProjectFormDialog({
  project,
  trigger,
}: {
  project?: Project;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const data: ProjectFormData = {
      name: formData.get("name") as string,
      type: formData.get("type") as ProjectFormData["type"],
      niche: formData.get("niche") as string,
      language: formData.get("language") as string,
      status: formData.get("status") as ProjectFormData["status"],
      scaleStartDate: (formData.get("scaleStartDate") as string) || null,
      scaleEndDate: (formData.get("scaleEndDate") as string) || null,
    };

    startTransition(async () => {
      try {
        if (project) {
          await updateProject(project.id, data);
        } else {
          await createProject(data);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? "Editar Projeto" : "Novo Projeto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue={project?.type ?? "vsl"}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Projeto</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">Nicho</Label>
            <Select name="niche" defaultValue={project?.niche ?? nicheOptions[0]}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o nicho" />
              </SelectTrigger>
              <SelectContent>
                {nicheOptions.map((niche) => (
                  <SelectItem key={niche} value={niche}>
                    {niche}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Idioma</Label>
            <Select name="language" defaultValue={project?.language ?? languageOptions[0]}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o idioma" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={project?.status ?? "em_teste"}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scaleStartDate">Data início escala</Label>
              <Input
                id="scaleStartDate"
                name="scaleStartDate"
                type="date"
                defaultValue={project?.scaleStartDate ? new Date(project.scaleStartDate).toISOString().split("T")[0] : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scaleEndDate">Data fim escala</Label>
              <Input
                id="scaleEndDate"
                name="scaleEndDate"
                type="date"
                defaultValue={project?.scaleEndDate ? new Date(project.scaleEndDate).toISOString().split("T")[0] : ""}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
