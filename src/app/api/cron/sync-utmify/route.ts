import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { DASHBOARDS, fetchDashboardSummary, fetchMetaAdObjects, extractOfferFromCampaignName } from "@/lib/utmify";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.UTMIFY_API_KEY) {
    return NextResponse.json({ error: "UTMIFY_API_KEY not configured" }, { status: 500 });
  }

  // Yesterday at 00:00 (stored as snapshot date — represents the day the data refers to)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const results: { dashboard: string; status: string; dailySnapshots?: number; error?: string }[] = [];

  for (const dashboard of DASHBOARDS) {
    try {
      // Summary-level snapshot (legacy entityType="dashboard")
      const summary = await fetchDashboardSummary(dashboard.id, dashboard.timeZone);
      await db.insert(metricsSnapshots).values({
        date: yesterday,
        entityType: "dashboard",
        entityId: 0,
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

      // Campaign-level daily snapshots (entityType="utmify_campaign_daily")
      // Each row = one campaign's spend/revenue for `yesterday`.
      // Used for period filters (Hoje/7d/15d/30d/Este mes/Mes passado) via aggregation.
      let dailySnapshots = 0;
      try {
        const metaData = await fetchMetaAdObjects(dashboard.id, dashboard.timeZone);
        for (const campaign of metaData.results) {
          const offerName = extractOfferFromCampaignName(campaign.name);
          await db.insert(metricsSnapshots).values({
            date: yesterday,
            entityType: "utmify_campaign_daily",
            entityId: 0,
            source: "utmify",
            impressions: campaign.impressions ?? null,
            clicks: campaign.clicks ?? null,
            spend: campaign.spend != null ? String(campaign.spend / 100) : null,
            revenue: campaign.revenue != null ? String(campaign.revenue / 100) : null,
            cpa: campaign.cpa != null ? String(campaign.cpa / 100) : null,
            roas: campaign.roas != null ? String(campaign.roas) : null,
            extraData: {
              campaignName: campaign.name,
              campaignId: campaign.id,
              offerName,
              dashboardId: dashboard.id,
              currency: dashboard.currency,
            },
          });
          dailySnapshots++;
        }
      } catch (err) {
        console.error("[UTMify] Daily campaign sync error:", err);
      }

      results.push({ dashboard: dashboard.name, status: "ok", dailySnapshots });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[UTMify Sync] Error for ${dashboard.name}:`, message);
      results.push({ dashboard: dashboard.name, status: "error", error: message });
    }
  }

  return NextResponse.json({
    success: true,
    syncedAt: new Date().toISOString(),
    snapshotDate: yesterday.toISOString(),
    results,
  });
}
