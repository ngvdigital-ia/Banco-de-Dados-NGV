import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/admin-auth";
import { listTeamMembers, listInvitations } from "@/lib/clerk-team";
import { TeamManagementClient } from "./team-management-client";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const me = await getCurrentUser();
  if (!me?.email) redirect("/sign-in");
  if (!isAdminEmail(me.email)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem gerenciar a equipe. Se você precisa de
          acesso, peça pro admin atual te adicionar.
        </p>
      </div>
    );
  }

  const [members, invitations] = await Promise.all([
    listTeamMembers(),
    listInvitations(),
  ]);

  return (
    <TeamManagementClient
      currentUserId={me.id}
      members={members}
      invitations={invitations}
    />
  );
}
