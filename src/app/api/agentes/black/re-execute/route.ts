import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

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
    return NextResponse.json(
      { error: "task_id obrigatório" },
      { status: 400 },
    );
  }

  // Dispara webhook do Black com feedback no payload.
  // TODO: o workflow Black hoje só usa body.task_id; precisa update pra
  //   injetar `feedback` no system/user prompt do agente Managed Black.
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: body.task_id,
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

  return NextResponse.json({ ok: true });
}
