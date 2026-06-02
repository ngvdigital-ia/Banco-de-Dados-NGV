"use client";

import { useState, useTransition } from "react";
import { FolderOpen } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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

  const isEditing = !!project;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <FolderOpen className="h-4 w-4" />
            </div>
            <DialogTitle>
              {isEditing ? "Editar Projeto" : "Novo Projeto"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Separator className="opacity-50" />

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Tipo */}
          <FormField label="Tipo">
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
          </FormField>

          {/* Nome */}
          <FormField label="Nome do Projeto">
            <Input
              id="name"
              name="name"
              defaultValue={project?.name}
              placeholder="Ex: VSL Emagrecimento PT v3"
              required
            />
          </FormField>

          {/* Grid: Nicho + Idioma */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nicho">
              <Select name="niche" defaultValue={project?.niche ?? nicheOptions[0]}>
                <SelectTrigger>
                  <SelectValue placeholder="Nicho" />
                </SelectTrigger>
                <SelectContent>
                  {nicheOptions.map((niche) => (
                    <SelectItem key={niche} value={niche}>
                      {niche}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Idioma">
              <Select name="language" defaultValue={project?.language ?? languageOptions[0]}>
                <SelectTrigger>
                  <SelectValue placeholder="Idioma" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Status */}
          <FormField label="Status">
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
          </FormField>

          {/* Datas de escala */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Início da escala">
              <Input
                id="scaleStartDate"
                name="scaleStartDate"
                type="date"
                defaultValue={
                  project?.scaleStartDate
                    ? new Date(project.scaleStartDate).toISOString().split("T")[0]
                    : ""
                }
              />
            </FormField>
            <FormField label="Fim da escala">
              <Input
                id="scaleEndDate"
                name="scaleEndDate"
                type="date"
                defaultValue={
                  project?.scaleEndDate
                    ? new Date(project.scaleEndDate).toISOString().split("T")[0]
                    : ""
                }
              />
            </FormField>
          </div>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger-muted px-3 py-2 text-xs text-danger-muted-foreground">
              {error}
            </p>
          )}

          <Separator className="opacity-50" />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[80px]">
              {isPending ? "Salvando…" : isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
