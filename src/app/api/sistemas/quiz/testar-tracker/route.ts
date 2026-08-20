import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/admin-auth";
import { handleTestarTrackerRequest } from "@/lib/sistemas/quiz/testar-tracker-core.mjs";

// POST /api/sistemas/quiz/testar-tracker
// Body: { projectId, funnelId, pageId, origin }
//
// Teste B (servidor) da aba "Instalar tracker": dispara um OPTIONS real contra o
// quiz-analytics com Origin = domínio do FUNIL digitado (nunca o do painel) — nunca um POST,
// porque o tracker não tem modo de teste e um POST bem-sucedido gravaria um evento de
// verdade (ver testar-tracker-core.mjs pro porquê). project_id/funnel_id não são
// verificáveis sem gravar; a rota devolve isso explícito, nunca finge "ok".
//
// Auth: Clerk session + ADMIN_EMAILS, mesmo padrão de /api/admin-ui/team.
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const result = await handleTestarTrackerRequest(payload);
  return NextResponse.json(result.body, { status: result.status });
}
