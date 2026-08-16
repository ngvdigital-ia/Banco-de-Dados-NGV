import "server-only";
import { AdminAuthError, getCurrentUser } from "@/lib/admin-auth";
import type { SystemId } from "@/lib/operacao/system-directory";
import { MODULE_CAPABILITIES, hasModuleAccess, moduleAllowlist } from "./authz-core.mjs";

export { MODULE_CAPABILITIES, hasModuleAccess, moduleAllowlist };

export type ModuleCapability = "read" | "mutate";

// Gate de autorização dos módulos internos (/sistemas/<modulo>). Mesmo formato de
// requireOperationOperator() (src/lib/operacao/authz.ts): allowlist de e-mail
// congelada, erro tipado com status. moduleId identifica o módulo pra mensagem de
// erro e para uso futuro (allowlist por módulo); Fase 1 só popula `read`.
export async function requireModuleAccess(
  moduleId: SystemId,
  capability: ModuleCapability,
): Promise<{ id: string; email: string }> {
  const me = await getCurrentUser();
  if (!me?.email) {
    throw new AdminAuthError("Não autenticado", 401);
  }
  if (!hasModuleAccess(me.email, capability)) {
    throw new AdminAuthError(
      `Acesso negado: sem permissão de ${capability} no módulo ${moduleId}`,
      403,
    );
  }
  return { id: me.id, email: me.email };
}
