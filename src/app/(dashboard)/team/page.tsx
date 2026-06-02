import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamFormDialog } from "@/components/forms/team-form";
import { getTeamMembers, deleteTeamMember } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  copywriter: "Copywriter",
  editor: "Editor",
  gestor_trafego: "Gestor de Tráfego",
  suporte: "Suporte",
};

type RoleBadgeVariant = "info" | "default" | "secondary" | "outline";

const roleBadgeVariant: Record<string, RoleBadgeVariant> = {
  admin: "info",
  copywriter: "default",
  editor: "secondary",
  gestor_trafego: "outline",
};

export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Equipe"
        description="Gerencie os membros da equipe NGV: copywriters, editores e gestores de tráfego."
      >
        <TeamFormDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Novo Membro
            </Button>
          }
        />
      </PageHeader>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-4">
          <EmptyState
            icon={Users}
            title="Nenhum membro ainda"
            description="Cadastre os membros da equipe (copywriters, editores, gestores de tráfego)."
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border shadow-sm overflow-hidden ring-1 ring-foreground/5">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Função</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow
                  key={member.id}
                  className="transition-colors duration-150 hover:bg-muted/30"
                >
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{member.email}</TableCell>
                  <TableCell>
                    {roleBadgeVariant[member.role] === "info" ? (
                      <StatusBadge variant="info">
                        {roleLabels[member.role] ?? member.role}
                      </StatusBadge>
                    ) : (
                      <Badge
                        variant={
                          (roleBadgeVariant[member.role] as Exclude<RoleBadgeVariant, "info">) ??
                          "default"
                        }
                      >
                        {roleLabels[member.role] ?? member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={member.active ? "success" : "neutral"}>
                      {member.active ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TeamFormDialog
                        member={member}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Editar ${member.name}`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteTeamMember(member.id);
                        }}
                      >
                        <Button variant="ghost" size="icon" type="submit" aria-label={`Excluir ${member.name}`}>
                          <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                        </Button>
                      </form>
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
