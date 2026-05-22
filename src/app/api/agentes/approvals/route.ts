import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentApprovals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  updateTaskStatus,
  postComment,
  getTask,
  getCustomFieldValue,
} from "@/lib/agentes/clickup/tasks";
import { notifyRejectionViaN8n } from "@/lib/agentes/notify";

// Status da lista de ofertas pra onde a task volta ao ser rejeitada.
const STATUS_EM_AJUSTES = "em ajustes";

interface CreateApprovalBody {
  task_id: string; // mapeado pra taskId no insert
  agent: "black" | "white";
  action: "approve" | "reject"; // mapeado pra acao = approved/rejected
  exec_id?: string; // → executionId
  session_id?: string;
  feedback?: string;
  audio_url?: string; // → feedbackAudioUrl
  oferta_nome?: string; // opcional: nome da oferta p/ notificação (senão busca no ClickUp)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  let body: CreateApprovalBody;
  try {
    body = (await req.json()) as CreateApprovalBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.task_id || !body.agent || !body.action) {
    return NextResponse.json(
      {
        error: "missing fields",
        required: ["task_id", "agent", "action"],
      },
      { status: 400 },
    );
  }
  if (!["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (!["black", "white"].includes(body.agent)) {
    return NextResponse.json({ error: "invalid agent" }, { status: 400 });
  }

  const acao = body.action === "approve" ? "approved" : "rejected";

  // 1. Grava o approval no Neon. Esta é a única operação que pode falhar o request.
  let data;
  try {
    [data] = await db
      .insert(agentApprovals)
      .values({
        taskId: body.task_id,
        agente: body.agent,
        acao,
        executionId: body.exec_id ?? null,
        sessionId: body.session_id ?? null,
        feedback: body.feedback ?? null,
        feedbackAudioUrl: body.audio_url ?? null,
        userId,
        userEmail: email,
      })
      .returning();
  } catch (err) {
    console.error("Erro ao criar approval:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2. Side effects do reject — ClickUp + notificação Slack (via n8n).
  //    Cada um é isolado: se falhar, loga mas NÃO invalida o approval salvo.
  const sideEffects: Record<string, string> = {};
  if (body.action === "reject") {
    const feedback = body.feedback?.trim() || "(sem feedback)";
    const clickupUrl = `https://app.clickup.com/t/${body.task_id}`;

    // Resolve o nome da oferta: body > custom field/nome no ClickUp > task_id.
    let ofertaNome = body.oferta_nome?.trim() || "";
    if (!ofertaNome) {
      try {
        const task = await getTask(body.task_id, { subtasks: false });
        ofertaNome =
          (getCustomFieldValue(task, "Nome da oferta") as string) ||
          task.name ||
          body.task_id;
      } catch {
        ofertaNome = body.task_id;
      }
    }

    // 2a. Status da task → "Em ajustes".
    try {
      await updateTaskStatus(body.task_id, STATUS_EM_AJUSTES);
      sideEffects.clickup_status = "ok";
    } catch (e) {
      sideEffects.clickup_status = e instanceof Error ? e.message : "erro";
      console.error("reject: falha ao mudar status ClickUp", e);
    }

    // 2b. Comentário no card com o feedback.
    try {
      await postComment(
        body.task_id,
        `🛑 Produto ${body.agent.toUpperCase()} rejeitado por ${email}.\n\nMotivo:\n${feedback}`,
      );
      sideEffects.clickup_comment = "ok";
    } catch (e) {
      sideEffects.clickup_comment = e instanceof Error ? e.message : "erro";
      console.error("reject: falha ao comentar no ClickUp", e);
    }

    // 2c. Notificação no #triagem-ngv (via webhook n8n).
    try {
      await notifyRejectionViaN8n({
        task_id: body.task_id,
        agent: body.agent,
        feedback,
        user_email: email,
        oferta_nome: ofertaNome,
        clickup_url: clickupUrl,
      });
      sideEffects.slack = "ok";
    } catch (e) {
      sideEffects.slack = e instanceof Error ? e.message : "erro";
      console.error("reject: falha ao notificar Slack via n8n", e);
    }
  }

  return NextResponse.json({ approval: data, side_effects: sideEffects }, {
    status: 201,
  });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("task_id");

  try {
    const rows = await db
      .select()
      .from(agentApprovals)
      .where(taskId ? eq(agentApprovals.taskId, taskId) : undefined)
      .orderBy(desc(agentApprovals.createdAt));

    return NextResponse.json({ approvals: rows });
  } catch (err) {
    console.error("Erro ao buscar approvals:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
