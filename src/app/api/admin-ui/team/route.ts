import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminAuthError } from "@/lib/admin-auth";
import { listTeamMembers, inviteUser, listInvitations } from "@/lib/clerk-team";
import { logTeamAction } from "@/lib/team-audit";

// GET /api/admin-ui/team
// Lista todos os Clerk users (membros da equipe) + invitations pendentes.
// Auth: Clerk session + email na ADMIN_EMAILS allowlist.
export async function GET() {
  try {
    const me = await requireAdmin();
    const [members, invitations] = await Promise.all([
      listTeamMembers(),
      listInvitations(),
    ]);
    await logTeamAction({ action: "list", actorEmail: me.email });
    return NextResponse.json({ members, invitations });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/admin-ui/team  → invite new user
// Body: { email: string }
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(request: Request) {
  try {
    const me = await requireAdmin();
    const body = inviteSchema.parse(await request.json());
    const url = new URL(request.url);
    const redirectUrl = `${url.origin}/sign-in`;
    const invitation = await inviteUser(body.email, redirectUrl);
    await logTeamAction({
      action: "invite",
      actorEmail: me.email,
      targetEmail: body.email,
      extra: { invitationId: invitation.id },
    });
    return NextResponse.json({ success: true, invitation });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown): NextResponse {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Payload inválido", issues: err.issues },
      { status: 400 },
    );
  }
  const message = err instanceof Error ? err.message : "Internal error";
  console.error("[admin-ui/team]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
