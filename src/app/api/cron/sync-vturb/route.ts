import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VTURB_API_KEY) {
    return NextResponse.json(
      { error: "VTURB_API_KEY not configured", message: "Adicione VTURB_API_KEY nas variáveis de ambiente para ativar a sincronização VTurb." },
      { status: 200 }
    );
  }

  // TODO: Implement VTurb sync when API is available
  // 1. Fetch list of videos from VTurb
  // 2. For each video, call fetchVideoAnalytics()
  // 3. Save metrics to metricsSnapshots with entityType="vturb_video"

  return NextResponse.json({
    success: true,
    message: "VTurb sync placeholder — API integration pending",
    syncedAt: new Date().toISOString(),
  });
}
