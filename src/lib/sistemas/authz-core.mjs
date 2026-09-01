import { OPERATION_OPERATOR_EMAILS } from "../operacao/authz-core.mjs";

// Duas capacidades por módulo, não uma matriz N×M especulativa. `read` reusa os
// mesmos operadores já em produção em OPERATION_OPERATOR_EMAILS. A capacidade
// `mutate` identifica o operador; cada integração ainda deve ter seu próprio
// gate server-only antes de tocar o sistema externo.
export const MODULE_CAPABILITIES = Object.freeze(["read", "mutate"]);

const READ_ALLOWLIST = Object.freeze(
  OPERATION_OPERATOR_EMAILS.map((email) => email.toLowerCase()),
);
// Decisão do operador em 2026-08-16: quem pode EXECUTAR AÇÃO é "ele + a equipe que já usa
// os painéis". Isso é exatamente quem já está em OPERATION_OPERATOR_EMAILS — não inventamos
// e-mail de ninguém aqui; se a equipe crescer, cresce naquela lista e reflete nas duas.
//
// O ganho real desta linha não é permitir mais coisa: é que a mesma pessoa que hoje age por
// uma SENHA COMPARTILHADA (sem identidade e sem rastro, nos 4 sistemas) passa a agir com
// identidade individual do Clerk e trilha em module_action_log.
//
// Não basta para acionar o Spy: mutations.ts também exige
// SISTEMAS_SPY_MUTATIONS_ENABLED=true. A separação impede que liberar a leitura do painel
// transforme a allowlist de operadores em autorização de escrita externa.
const MUTATE_ALLOWLIST = READ_ALLOWLIST;

export function moduleAllowlist(capability) {
  if (capability === "read") return READ_ALLOWLIST;
  if (capability === "mutate") return MUTATE_ALLOWLIST;
  return Object.freeze([]);
}

export function hasModuleAccess(email, capability) {
  if (typeof email !== "string") return false;
  return moduleAllowlist(capability).includes(email.toLowerCase());
}
