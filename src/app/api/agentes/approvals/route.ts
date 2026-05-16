import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentApprovals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

interface CreateApprovalBody {
  task_id: string; // mapeado pra taskId no insert
  agent: "black" | "white";
  action: "approve" | "reject"; // mapeado pra acao = approved/rejected
  exec_id?: string; // → executionId
  session_id?: string;
  feedback?: string;
  audio_url?: string; // → feedbackAudioUrl
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

  try {
    const [data] = await db.insert(agentApprovals).values({
      taskId: body.task_id,
      agente: body.agent,
      acao,
      executionId: body.exec_id ?? null,
      sessionId: body.session_id ?? null,
      feedback: body.feedback ?? null,
      feedbackAudioUrl: body.audio_url ?? null,
      userId,
      userEmail: email,
    }).returning();

    return NextResponse.json({ approval: data }, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar approval:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
