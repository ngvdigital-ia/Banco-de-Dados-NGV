import { OPERATION_OPERATOR_EMAILS } from "../operacao/authz-core.mjs";

// Fase 1 (ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 2): duas capacidades
// por módulo, não uma matriz N×M especulativa. `read` reusa os mesmos operadores
// já em produção em OPERATION_OPERATOR_EMAILS. `mutate` fica vazio até existir um
// módulo que efetivamente mute (Spy Fase 3 / Apps Fase 4) — ninguém entra até lá.
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
// Inócua hoje: nenhuma ação de mutação está habilitada (o disparo de push dos Cursos está
// com o botão desabilitado por decisão do operador, e Quiz/Spy são leitura pura).
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
