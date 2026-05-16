import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { aggregateOfertas } from "@/lib/agentes/ofertas/aggregate";

// Cache server-side: revalida a cada 60s
export const revalidate = 60;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const ofertas = await aggregateOfertas();
    return NextResponse.json({
      ofertas,
      atualizado_em: new Date().toISOString(),
      total: ofertas.length,
    });
  } catch (err) {
    console.error("Erro ao agregar ofertas:", err);
    const message =
      err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "internal", message },
      { status: 500 },
    );
  }
}
