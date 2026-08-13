import "server-only";
import { AdminAuthError, getCurrentUser } from "@/lib/admin-auth";
import { isOperationOperator, OPERATION_OPERATOR_EMAILS } from "./authz-core.mjs";

export { isOperationOperator, OPERATION_OPERATOR_EMAILS };

export async function requireOperationOperator(): Promise<{ id: string; email: string }> {
  const me = await getCurrentUser();
  if (!me?.email) {
    throw new AdminAuthError("Não autenticado", 401);
  }
  if (!isOperationOperator(me.email)) {
    throw new AdminAuthError("Acesso negado: somente operadores da operação", 403);
  }
  return { id: me.id, email: me.email };
}
