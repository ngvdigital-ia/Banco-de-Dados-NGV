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
import { TeamFormDialog } from "@/components/forms/team-form";
import { getTeamMembers, deleteTeamMember } from "./actions";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  copywriter: "Copywriter",
  editor: "Editor",
  gestor_trafego: "Gestor de Tráfego",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  admin: "destructive",
  copywriter: "default",
  editor: "secondary",
  gestor_trafego: "outline",
};

export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Equipe</h1>
        <TeamFormDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Membro
            </Button>
          }
        />
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Nenhum membro ainda</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre os membros da equipe (copywriters, editores, gestores de
            tráfego).
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[member.role] ?? "default"}>
                      {roleLabels[member.role] ?? member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.active ? "default" : "secondary"}>
                      {member.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TeamFormDialog
                        member={member}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteTeamMember(member.id);
                        }}
                      >
                        <Button variant="ghost" size="icon" type="submit">
                          <Trash2 className="h-4 w-4 text-destructive" />
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
