import { NextResponse } from "next/server";
import { db } from "@/db";
import { vsls, metricsSnapshots } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { fetchVideoAnalytics, extractVideoId } from "@/lib/vturb";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VTURB_API_KEY) {
    return NextResponse.json({
      success: false,
      message: "VTURB_API_KEY not configured",
    });
  }

  // Get all VSLs that have a BTube link
  const vslsWithLinks = await db
    .select({ id: vsls.id, btubeLink: vsls.btubeLink })
    .from(vsls)
    .where(isNotNull(vsls.btubeLink));

  const results: { vslId: number; status: string; error?: string }[] = [];

  for (const vsl of vslsWithLinks) {
    if (!vsl.btubeLink) continue;

    const videoId = extractVideoId(vsl.btubeLink);
    if (!videoId) {
      results.push({ vslId: vsl.id, status: "skipped", error: "Could not extract video ID" });
      continue;
    }

    try {
      const analytics = await fetchVideoAnalytics(videoId);
      if (!analytics) {
        results.push({ vslId: vsl.id, status: "skipped", error: "No analytics data" });
        continue;
      }

      await db.insert(metricsSnapshots).values({
        date: new Date(),
        entityType: "vsl",
        entityId: vsl.id,
        source: "utmify", // using closest available source enum
        pageVisits: analytics.views ?? null,
        playRate: analytics.playRate ? String(analytics.playRate) : null,
        videoRetentionJson: analytics.retention ?? null,
        extraData: {
          source: "vturb",
          videoId,
          title: analytics.title,
          uniqueViews: analytics.uniqueViews,
          avgWatchTime: analytics.avgWatchTime,
        },
      });

      results.push({ vslId: vsl.id, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[VTurb] Error for VSL ${vsl.id}:`, msg);
      results.push({ vslId: vsl.id, status: "error", error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    syncedAt: new Date().toISOString(),
    totalVsls: vslsWithLinks.length,
    results,
  });
}
