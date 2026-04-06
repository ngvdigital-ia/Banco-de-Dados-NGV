import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { fetchPlayers, fetchEventsByPlayer, fetchSessionStats, fetchUserEngagement } from "@/lib/vturb";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VTURB_API_KEY) {
    return NextResponse.json({ success: false, message: "VTURB_API_KEY not configured" });
  }

  // Date range: last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const dateFrom = weekAgo.toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];

  const results: { player: string; status: string; error?: string }[] = [];

  try {
    // 1. List all players
    const playersData = await fetchPlayers(dateFrom, dateTo);
    if (!playersData?.players?.length) {
      return NextResponse.json({
        success: true,
        message: "No players found in VTurb",
        syncedAt: now.toISOString(),
      });
    }

    const playerHashes = playersData.players.map((p) => p.id);

    // 2. Get events per player
    const events = await fetchEventsByPlayer(playerHashes, dateFrom, dateTo);

    // 3. Get session stats
    const sessions = await fetchSessionStats(playerHashes, dateFrom, dateTo);

    // 4. Get engagement/retention
    const engagement = await fetchUserEngagement(playerHashes, dateFrom, dateTo);

    // 5. Save each player's data
    for (const player of playersData.players) {
      try {
        await db.insert(metricsSnapshots).values({
          date: now,
          entityType: "vturb_player",
          entityId: 0,
          source: "manual", // closest available enum
          extraData: {
            source: "vturb",
            playerId: player.id,
            playerName: player.name,
            dateRange: { from: dateFrom, to: dateTo },
            events: events ?? null,
            sessions: sessions ?? null,
            engagement: engagement ?? null,
          },
        });
        results.push({ player: player.name, status: "ok" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        results.push({ player: player.name, status: "error", error: msg });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg });
  }

  return NextResponse.json({
    success: true,
    syncedAt: now.toISOString(),
    results,
  });
}
