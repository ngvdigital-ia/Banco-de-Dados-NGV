"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
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
  createTeamMember,
  updateTeamMember,
  type TeamMemberFormData,
} from "@/app/(dashboard)/team/actions";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  copywriter: "Copywriter",
  editor: "Editor",
  gestor_trafego: "Gestor de Tráfego",
  suporte: "Suporte",
};

type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "copywriter" | "editor" | "gestor_trafego" | "suporte";
  active: boolean;
};

export function TeamFormDialog({
  member,
  trigger,
}: {
  member?: TeamMember;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const data: TeamMemberFormData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as TeamMemberFormData["role"],
      active: true,
    };

    startTransition(async () => {
      try {
        if (member) {
          await updateTeamMember(member.id, data);
        } else {
          await createTeamMember(data);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  const isEditing = !!member;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <DialogTitle>
              {isEditing ? "Editar Membro" : "Novo Membro"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Separator className="opacity-50" />

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Nome */}
          <FormField label="Nome completo">
            <Input
              id="name"
              name="name"
              defaultValue={member?.name}
              placeholder="Ex: João Silva"
              required
            />
          </FormField>

          {/* Email */}
          <FormField label="E-mail">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={member?.email}
              placeholder="joao@ngvdigital.com"
              required
            />
          </FormField>

          {/* Função */}
          <FormField label="Função">
            <Select name="role" defaultValue={member?.role ?? "copywriter"}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

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
              {isPending ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
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
