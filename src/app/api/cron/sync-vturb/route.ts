import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { fetchPlayers, fetchEventsByPlayer, fetchSessionStats } from "@/lib/vturb";

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
    // 1. List all players (single bulk GET)
    const playersData = await fetchPlayers();
    if (!playersData?.players?.length) {
      return NextResponse.json({
        success: true,
        message: "No players found in VTurb",
        syncedAt: now.toISOString(),
      });
    }

    const playerIds = playersData.players.map((p) => p.id);

    // 2. Get events per player (single bulk POST — returns Map)
    const eventsMap = await fetchEventsByPlayer(playerIds, dateFrom, dateTo);

    // 3. Only save players that have activity (avoid 300+ empty rows)
    const playersWithData = playersData.players.filter((p) => {
      const ev = eventsMap?.get(p.id);
      return ev && (ev.started > 0 || ev.viewed > 0);
    });

    // Also save players without data but limit to avoid bloat
    const playersWithoutData = playersData.players
      .filter((p) => !playersWithData.find((pw) => pw.id === p.id))
      .slice(0, 20); // keep only 20 recent inactive

    const allToSave = [...playersWithData, ...playersWithoutData];

    // 4. Fetch session stats in batches of 5 for players with activity (rate-limit safe)
    const sessionStatsMap = new Map<string, { playRate: string; buttonClickRate: string; conversionRate: string }>();
    const playersWithActivity = playersWithData.filter((p) => (eventsMap?.get(p.id)?.started ?? 0) > 0);

    for (let i = 0; i < playersWithActivity.length; i += 5) {
      const batch = playersWithActivity.slice(i, i + 5);
      await Promise.all(
        batch.map(async (player) => {
          try {
            const stats = await fetchSessionStats(player.id, dateFrom, dateTo);
            if (stats) {
              sessionStatsMap.set(player.id, {
                playRate: stats.play_rate,
                buttonClickRate: stats.over_pitch_rate,
                conversionRate: String(stats.overall_conversion_rate),
              });
            }
          } catch (err) {
            console.error(`[VTurb] Session stats skipped for player ${player.id}:`, err);
          }
        })
      );
    }

    for (const player of allToSave) {
      try {
        const events = eventsMap?.get(player.id) ?? { started: 0, finished: 0, viewed: 0, clicked: 0 };

        const playRate = events.viewed > 0
          ? Math.round((events.started / events.viewed) * 10000) / 100
          : 0;
        const finishRate = events.started > 0
          ? Math.round((events.finished / events.started) * 10000) / 100
          : 0;

        const sessionStats = sessionStatsMap.get(player.id);

        await db.insert(metricsSnapshots).values({
          date: now,
          entityType: "vturb_player",
          entityId: 0,
          source: "manual",
          // Typed columns from VTurb session stats (only for players with activity)
          playRate: sessionStats?.playRate ?? String(playRate),
          buttonClickRate: sessionStats?.buttonClickRate ?? null,
          conversionRate: sessionStats?.conversionRate ?? null,
          extraData: {
            source: "vturb",
            playerId: player.id,
            playerName: player.name,
            duration: player.duration ?? 0,
            pitchTime: player.pitch_time ?? 0,
            dateRange: { from: dateFrom, to: dateTo },
            started: events.started,
            finished: events.finished,
            viewed: events.viewed,
            clicked: events.clicked,
            playRate,
            finishRate,
          },
        });
        results.push({
          player: player.name,
          status: `ok (plays: ${events.started}, views: ${events.viewed})`,
        });
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
    totalPlayers: results.length,
    withActivity: results.filter((r) => !r.status.includes("plays: 0, views: 0")).length,
    results,
  });
}
