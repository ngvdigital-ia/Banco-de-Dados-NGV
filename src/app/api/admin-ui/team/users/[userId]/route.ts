import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError, ADMIN_EMAILS } from "@/lib/admin-auth";
import { banUser, unbanUser, deleteUser, listTeamMembers } from "@/lib/clerk-team";
import { logTeamAction } from "@/lib/team-audit";

type Params = { params: Promise<{ userId: string }> };

// POST /api/admin-ui/team/users/[userId]  → ban or unban (action via query: ?action=ban|unban)
export async function POST(request: Request, { params }: Params) {
  try {
    const me = await requireAdmin();
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action !== "ban" && action !== "unban") {
      return NextResponse.json(
        { error: "action deve ser 'ban' ou 'unban'" },
        { status: 400 },
      );
    }

    // Proteção: não ban/unban o próprio user e não ban outros admins
    const target = await findTarget(userId);
    if (target?.email && ADMIN_EMAILS.includes(target.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Não é possível banir um admin. Remova-o do allowlist primeiro." },
        { status: 403 },
      );
    }
    if (userId === me.id) {
      return NextResponse.json(
        { error: "Não é possível banir a si mesmo" },
        { status: 403 },
      );
    }

    if (action === "ban") await banUser(userId);
    else await unbanUser(userId);

    await logTeamAction({
      action,
      actorEmail: me.email,
      targetUserId: userId,
      targetEmail: target?.email ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/admin-ui/team/users/[userId]  → permanently delete user
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const me = await requireAdmin();
    const { userId } = await params;

    const target = await findTarget(userId);
    if (target?.email && ADMIN_EMAILS.includes(target.email.toLowerCase())) {
      return NextResponse.json(
        { error: "Não é possível deletar um admin. Remova-o do allowlist primeiro." },
        { status: 403 },
      );
    }
    if (userId === me.id) {
      return NextResponse.json(
        { error: "Não é possível deletar a si mesmo" },
        { status: 403 },
      );
    }

    await deleteUser(userId);
    await logTeamAction({
      action: "delete",
      actorEmail: me.email,
      targetUserId: userId,
      targetEmail: target?.email ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

async function findTarget(userId: string) {
  try {
    const members = await listTeamMembers();
    return members.find((m) => m.id === userId);
  } catch {
    return undefined;
  }
}

function handleError(err: unknown): NextResponse {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Internal error";
  console.error("[admin-ui/team/users/userId]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
