import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin-auth";
import { revokeInvitation } from "@/lib/clerk-team";
import { logTeamAction } from "@/lib/team-audit";

type Params = { params: Promise<{ invitationId: string }> };

// DELETE /api/admin-ui/team/invitations/[invitationId]  → revoke pending invite
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const me = await requireAdmin();
    const { invitationId } = await params;
    await revokeInvitation(invitationId);
    await logTeamAction({
      action: "revoke_invite",
      actorEmail: me.email,
      extra: { invitationId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
