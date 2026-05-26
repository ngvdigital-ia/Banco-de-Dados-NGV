// Allowlist de emails admin. Standalone (sem imports server-only)
// pra poder ser usado tanto no server quanto no client.
// Pra adicionar admin: 1) edita aqui, 2) commit, 3) deploy.
export const ADMIN_EMAILS = ["ngvdigital.ia@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
