import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

// Registra cada ação administrativa de gerenciamento de equipe.
// Não falha o request se logar quebrar (best-effort).
export async function logTeamAction(params: {
  action: "list" | "invite" | "ban" | "unban" | "delete" | "revoke_invite";
  actorEmail: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(metricsSnapshots).values({
      date: new Date(),
      entityType: "team_admin_action",
      entityId: 0,
      source: "manual",
      extraData: {
        action: params.action,
        actorEmail: params.actorEmail,
        targetUserId: params.targetUserId ?? null,
        targetEmail: params.targetEmail ?? null,
        ...(params.extra ?? {}),
      },
    });
  } catch (err) {
    console.error("[team-audit] failed to log action:", err);
  }
}
