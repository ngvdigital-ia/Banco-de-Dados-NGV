import { NextResponse } from "next/server";
import { handleAppsLookupRequest } from "@/lib/sistemas/apps/lookup-core.mjs";

// GET /api/admin/apps/lookup?email=<e-mail do cliente>
// Authorization: Bearer <CRON_SECRET>
//
// Responde "esse e-mail comprou o quê?" lendo SÓ do NGV Core (edge function
// apps-lookup-read → read_apps_lookup_by_email). O painel não abre conexão com o
// Supabase Apps.
//
// Auth no mesmo padrão de /api/admin/offers: isAuthorizedBearer(authHeader, CRON_SECRET),
// fail-closed — sem CRON_SECRET configurado ninguém entra. A regra completa (401, 400 de
// e-mail inválido, 200, 503 de config ausente) vive em lookup-core.mjs pra ser testável
// pelos dois lados sem subir o runtime do Next.
//
// Envs: NGV_CORE_APPS_LOOKUP_URL, NGV_CORE_BANCO_WRITER_KEY, NGV_CORE_HOST_ALLOWLIST.
//
// O e-mail entra e não sai: a resposta carrega só slugs, chaves de produto, ids de
// pedido e timestamps — e nada aqui é logado.

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);

  const result = await handleAppsLookupRequest({
    authHeader,
    email: searchParams.get("email"),
    secret: process.env.CRON_SECRET,
    config: {
      url: process.env.NGV_CORE_APPS_LOOKUP_URL,
      writerKey: process.env.NGV_CORE_BANCO_WRITER_KEY,
      hostAllowlist: process.env.NGV_CORE_HOST_ALLOWLIST,
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
