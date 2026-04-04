import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

// UTMify Dashboard IDs (from MCP discovery)
const DASHBOARDS = [
  { id: "668318317423b9c8af5f8bf9", name: "Principal-NGV DIGITAL", currency: "BRL", timezone: -3 },
  { id: "69654a9bbbb4781f7e2397ef", name: "Dash Conta em Dolar", currency: "USD", timezone: -5 },
];

// Vercel Cron: runs every 6 hours
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync-utmify", "schedule": "0 */6 * * *" }] }

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const utmifyApiKey = process.env.UTMIFY_API_KEY;
  if (!utmifyApiKey) {
    return NextResponse.json(
      { error: "UTMIFY_API_KEY not configured. Add it to environment variables." },
      { status: 500 }
    );
  }

  // TODO: When UTMify REST API is available, implement:
  // 1. For each dashboard, call UTMify API with yesterday's date range
  // 2. Get dashboard summary (spend, revenue, CPA, ROAS)
  // 3. Get Meta/TikTok ad objects at campaign level
  // 4. Map campaigns to internal entities via external_mappings table
  // 5. Save snapshots to metrics_snapshots with source='utmify'
  //
  // For now, this route is a placeholder ready for integration.
  // The UTMify MCP tools available via Claude provide:
  // - get_dashboards: list all dashboards
  // - get_dashboard_summary: orders, revenue, spend, CPA, ROAS by product/source/hour
  // - get_meta_ad_objects: Meta campaign/adset/ad level data
  // - get_tiktok_ad_objects: TikTok campaign/adgroup/ad level data
  // - get_google_ad_objects: Google campaign/adgroup/ad level data

  return NextResponse.json({
    success: true,
    message: "UTMify sync structure ready. Awaiting UTMIFY_API_KEY configuration.",
    dashboards: DASHBOARDS.map((d) => ({ id: d.id, name: d.name })),
  });
}
