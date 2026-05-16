import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listCandidatos } from "@/lib/agentes/triagem/client";

export const revalidate = 60;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const candidatos = await listCandidatos();
    candidatos.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return NextResponse.json({
      candidatos,
      atualizado_em: new Date().toISOString(),
      total: candidatos.length,
    });
  } catch (err) {
    console.error("Erro ao listar candidatos:", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "internal", message },
      { status: 500 },
    );
  }
}
