"use server";

import { requireModuleAccess } from "@/lib/sistemas/authz";
import { handleAppsLookupRequest } from "@/lib/sistemas/apps/lookup-core.mjs";

// Camada fina "use server" pro lookup de Apps — mesmo motivo de sistemas/spy/actions.ts:
// é a única forma de um Client Component chamar código server-only sem passar por uma
// API route.
//
// POR QUE NÃO CHAMAR /api/admin/apps/lookup DIRETO DO BROWSER: aquela rota é protegida
// por `Authorization: Bearer <CRON_SECRET>`. Pro browser mandar esse header, o segredo
// teria que chegar no cliente — exatamente o que não pode acontecer. Então o caminho é
// este: o Server Action roda no servidor e chama `handleAppsLookupRequest`, que É a regra
// da rota (a rota inteira é um adaptador de 12 linhas em cima desta função). Mesmo módulo,
// mesmos status (200/400/500/503), mesma projeção sem PII — só sem o salto HTTP do painel
// pra ele mesmo. A rota continua existindo e continua sendo o contrato pra agente externo.
//
// A credencial de ingress do Core (NGV_CORE_BANCO_WRITER_KEY) nunca sai daqui: quem fala
// com a edge function é o servidor, dentro de lookup-core.mjs.
//
// Authz: requireModuleAccess("apps-ofertas", "read") — a MESMA allowlist que o catch-all
// usava via requireOperationOperator (READ_ALLOWLIST é OPERATION_OPERATOR_EMAILS), então
// ninguém ganha nem perde acesso por conta desta tela.

export async function consultarAcessoAppsAction(email: string): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  await requireModuleAccess("apps-ofertas", "read");

  return handleAppsLookupRequest({
    // O bearer não trafega pelo browser: o gate de identidade desta chamada é o
    // requireModuleAccess acima (Clerk + allowlist), e o segredo é lido no servidor.
    authHeader: `Bearer ${process.env.CRON_SECRET ?? ""}`,
    secret: process.env.CRON_SECRET,
    email,
    config: {
      url: process.env.NGV_CORE_APPS_LOOKUP_URL,
      writerKey: process.env.NGV_CORE_BANCO_WRITER_KEY,
      hostAllowlist: process.env.NGV_CORE_HOST_ALLOWLIST,
    },
  });
}
