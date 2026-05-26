import { auth, clerkClient } from "@clerk/nextjs/server";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin-emails";

// Re-export pra compat com imports existentes
export { ADMIN_EMAILS, isAdminEmail };

export async function getCurrentUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  return { id: userId, email };
}

export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const me = await getCurrentUser();
  if (!me?.email) {
    throw new AdminAuthError("Não autenticado", 401);
  }
  if (!ADMIN_EMAILS.includes(me.email.toLowerCase())) {
    throw new AdminAuthError("Acesso negado: somente admins", 403);
  }
  return { id: me.id, email: me.email };
}

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}
