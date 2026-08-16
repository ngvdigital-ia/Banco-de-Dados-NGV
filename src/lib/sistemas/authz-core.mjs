import { OPERATION_OPERATOR_EMAILS } from "../operacao/authz-core.mjs";

// Fase 1 (ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 2): duas capacidades
// por módulo, não uma matriz N×M especulativa. `read` reusa os mesmos operadores
// já em produção em OPERATION_OPERATOR_EMAILS. `mutate` fica vazio até existir um
// módulo que efetivamente mute (Spy Fase 3 / Apps Fase 4) — ninguém entra até lá.
export const MODULE_CAPABILITIES = Object.freeze(["read", "mutate"]);

const READ_ALLOWLIST = Object.freeze(
  OPERATION_OPERATOR_EMAILS.map((email) => email.toLowerCase()),
);
const MUTATE_ALLOWLIST = Object.freeze([]);

export function moduleAllowlist(capability) {
  if (capability === "read") return READ_ALLOWLIST;
  if (capability === "mutate") return MUTATE_ALLOWLIST;
  return Object.freeze([]);
}

export function hasModuleAccess(email, capability) {
  if (typeof email !== "string") return false;
  return moduleAllowlist(capability).includes(email.toLowerCase());
}
