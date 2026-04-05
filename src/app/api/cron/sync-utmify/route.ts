import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { DASHBOARDS, fetchDashboardSummary, fetchMetaAdObjects } from "@/lib/utmify";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.UTMIFY_API_KEY) {
    return NextResponse.json({ error: "UTMIFY_API_KEY not configured" }, { status: 500 });
  }

  const results: { dashboard: string; status: string; error?: string }[] = [];

  for (const dashboard of DASHBOARDS) {
    try {
      const summary = await fetchDashboardSummary(dashboard.id, dashboard.timeZone);

      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Save consolidated metrics as a snapshot
      // Values from UTMify are in cents, convert to decimal
      await db.insert(metricsSnapshots).values({
        date: yesterday,
        entityType: "dashboard",
        entityId: 0, // dashboard-level
        source: "utmify",
        spend: summary.adSpend ? String(summary.adSpend / 100) : null,
        revenue: summary.revenue ? String(summary.revenue / 100) : null,
        cpa: summary.cpa ? String(summary.cpa / 100) : null,
        roas: summary.roas ? String(summary.roas) : null,
        extraData: {
          dashboardId: dashboard.id,
          dashboardName: dashboard.name,
          currency: dashboard.currency,
          ordersTotal: summary.ordersCount?.total ?? 0,
          ordersApproved: summary.ordersCount?.approved ?? 0,
          ordersPending: summary.ordersCount?.pending ?? 0,
          ordersRefunded: summary.ordersCount?.refunded ?? 0,
        },
      });

      // After summary sync, get campaign-level data
      try {
        const metaData = await fetchMetaAdObjects(dashboard.id, dashboard.timeZone);
        for (const campaign of metaData.results) {
          await db.insert(metricsSnapshots).values({
            date: yesterday,
            entityType: "meta_campaign",
            entityId: 0,
            source: "utmify",
            impressions: campaign.impressions ?? null,
            clicks: campaign.clicks ?? null,
            spend: campaign.spend ? String(campaign.spend / 100) : null,
            revenue: campaign.revenue ? String(campaign.revenue / 100) : null,
            cpa: campaign.cpa ? String(campaign.cpa / 100) : null,
            roas: campaign.roas ? String(campaign.roas) : null,
            extraData: { campaignName: campaign.name, campaignId: campaign.id, dashboardId: dashboard.id },
          });
        }
      } catch (err) {
        console.error("[UTMify] Meta campaign sync error:", err);
      }

      results.push({ dashboard: dashboard.name, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[UTMify Sync] Error for ${dashboard.name}:`, message);
      results.push({ dashboard: dashboard.name, status: "error", error: message });
    }
  }

  return NextResponse.json({
    success: true,
    syncedAt: new Date().toISOString(),
    results,
  });
}
