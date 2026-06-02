import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getTask, findSubtaskByName } from "@/lib/agentes/clickup/tasks";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  const webhookUrl = process.env.BLACK_MANUAL_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "BLACK_MANUAL_WEBHOOK_URL não configurado" },
      { status: 500 },
    );
  }

  let body: { task_id?: string; feedback?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.task_id) {
    return NextResponse.json({ error: "task_id obrigatório" }, { status: 400 });
  }

  // O dashboard manda o task_id da OFERTA-MÃE, mas o webhook Black precisa do ID
  // da subtarefa "Tradução da VSL" (o PostFilter do workflow exige nome ~ "tradução
  // da vsl" + parent). Resolvemos a subtarefa aqui antes de disparar.
  let traducaoSubId: string;
  try {
    const parent = await getTask(body.task_id, { subtasks: true });
    const sub = findSubtaskByName(parent, "tradução da vsl");
    if (!sub) {
      return NextResponse.json(
        {
          error:
            "Oferta sem subtarefa 'Tradução da VSL' — Black não pode re-executar",
        },
        { status: 422 },
      );
    }
    traducaoSubId = sub.id;
  } catch (e) {
    return NextResponse.json(
      { error: "falha ao resolver subtarefa de tradução", detail: String(e) },
      { status: 502 },
    );
  }

  // Dispara o webhook do Black com a subtarefa correta + feedback. O workflow
  // injeta o feedback no prompt do agente Managed Black (ver Fase 1).
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: traducaoSubId,
      feedback: body.feedback ?? "",
      source: "dashboard-reexec",
      reexec_by: email,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "webhook falhou", status: res.status, body: text.slice(0, 200) },
      { status: 500 },
    );
  }

  // Invalida o cache para que a aba /agentes reflita o novo estado "em execução".
  revalidateTag("agentes-ofertas", "max");

  return NextResponse.json({ ok: true });
}
