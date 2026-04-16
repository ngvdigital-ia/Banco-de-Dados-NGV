import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { extractOfferFromCampaignName } from "@/lib/utmify";
import { eq, and, gte, lte } from "drizzle-orm";

type DailyCampaignInput = {
  id: string;
  name: string;
  spend: number;      // cents
  revenue: number;    // cents
  impressions?: number;
  clicks?: number;
  cpa?: number | null;
  roas?: number | null;
  currency: string;
  dashboardId: string;
};

type RequestBody = {
  date: string; // ISO: "YYYY-MM-DD" — the day this data refers to
  campaigns: DailyCampaignInput[];
};

// POST /api/admin/sync-utmify-daily
// Authorization: Bearer <CRON_SECRET>
// Saves daily snapshots (entityType=utmify_campaign_daily). Called manually
// by Claude/MCP or external schedulers until UTMify REST API is re-enabled.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.date || !Array.isArray(body.campaigns)) {
    return NextResponse.json(
      { error: "Body must be { date: 'YYYY-MM-DD', campaigns: [...] }" },
      { status: 400 },
    );
  }

  const snapshotDate = new Date(`${body.date}T00:00:00.000Z`);
  if (isNaN(snapshotDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format (expected YYYY-MM-DD)" }, { status: 400 });
  }

  // Idempotency: wipe any existing daily snapshots for the same date
  const startOfDay = new Date(snapshotDate);
  const endOfDay = new Date(snapshotDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  await db
    .delete(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.entityType, "utmify_campaign_daily"),
        gte(metricsSnapshots.date, startOfDay),
        lte(metricsSnapshots.date, endOfDay),
      ),
    );

  let inserted = 0;
  for (const c of body.campaigns) {
    const offerName = extractOfferFromCampaignName(c.name);
    await db.insert(metricsSnapshots).values({
      date: snapshotDate,
      entityType: "utmify_campaign_daily",
      entityId: 0,
      source: "utmify",
      impressions: c.impressions ?? null,
      clicks: c.clicks ?? null,
      spend: c.spend != null ? String(c.spend / 100) : null,
      revenue: c.revenue != null ? String(c.revenue / 100) : null,
      cpa: c.cpa != null ? String(c.cpa / 100) : null,
      roas: c.roas != null ? String(c.roas) : null,
      extraData: {
        campaignName: c.name,
        campaignId: c.id,
        offerName,
        dashboardId: c.dashboardId,
        currency: c.currency,
      },
    });
    inserted++;
  }

  return NextResponse.json({
    success: true,
    date: body.date,
    inserted,
  });
}
