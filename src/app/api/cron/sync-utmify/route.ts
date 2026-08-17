import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { DASHBOARDS, fetchDashboardSummary, fetchMetaAdObjects } from "@/lib/utmify";
import { getDbCampaignMappings, resolveOfferFromCampaign } from "@/lib/offer-mappings";
import { isAuthorizedBearer } from "@/lib/auth-bearer.mjs";

export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.UTMIFY_API_KEY) {
    return NextResponse.json({ error: "UTMIFY_API_KEY not configured" }, { status: 500 });
  }

  // Carrega mapeamentos do banco 1x por execução do cron.
  // Se falhar, getDbCampaignMappings() retorna {} e o fallback hardcoded assume.
  const dbMap = await getDbCampaignMappings();

  // Yesterday at 00:00 (stored as snapshot date — represents the day the data refers to)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const results: {
    dashboard: string;
    status: string;
    dailySnapshots?: number;
    error?: string;
    // Sinal próprio pra falha ISOLADA da busca de campanhas: "status: ok" com
    // dailySnapshots: 0 sozinho é indistinguível de "não houve campanha hoje" —
    // este campo é o que diferencia os dois casos.
    campaignsError?: string;
  }[] = [];

  // Accumulate all rows — one batch insert per type at the end (avoids N round-trips and
  // makes re-runs safe when the caller retries: each dashboard loop is independent).
  const dashboardRows: (typeof metricsSnapshots.$inferInsert)[] = [];
  const campaignRows: (typeof metricsSnapshots.$inferInsert)[] = [];

  for (const dashboard of DASHBOARDS) {
    try {
      // Summary-level snapshot (legacy entityType="dashboard")
      const summary = await fetchDashboardSummary(dashboard.id, dashboard.timeZone);
      dashboardRows.push({
        date: yesterday,
        entityType: "dashboard",
        entityId: 0,
        source: "utmify",
        spend: summary.adSpend ? String(summary.adSpend / 100) : null,
        revenue: summary.revenue ? String(summary.revenue / 100) : null,
        cpa: summary.cpa ? String(summary.cpa / 100) : null,
        roas: summary.roas ? String(summary.roas) : null,
        // Coluna de idempotência (migration 0006): identifica unicamente este dashboard no dia.
        utmifyDashboardId: String(dashboard.id),
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
      let campaignsError: string | undefined;
      try {
        const metaData = await fetchMetaAdObjects(dashboard.id, dashboard.timeZone);
        for (const campaign of metaData.results) {
          try {
            const offerName = resolveOfferFromCampaign(campaign.name, dbMap);
            campaignRows.push({
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
              // Coluna de idempotência (migration 0006): identifica unicamente esta campanha no dia.
              utmifyCampaignId: String(campaign.id),
              extraData: {
                campaignName: campaign.name,
                campaignId: campaign.id,
                offerName,
                dashboardId: dashboard.id,
                currency: dashboard.currency,
              },
            });
            dailySnapshots++;
          } catch (err) {
            console.error(`[UTMify] Failed to build campaign row "${campaign.name}":`, err);
          }
        }
      } catch (err) {
        // Falha ISOLADA na busca de campanhas: o resumo do dashboard já foi obtido acima
        // (por isso o dashboard continua "ok"), mas dailySnapshots: 0 aqui não significa
        // "sem campanha hoje" — significa "não conseguimos nem checar". campaignsError
        // é o sinal que separa os dois casos no corpo da resposta.
        campaignsError = err instanceof Error ? err.message : "Unknown error";
        console.error("[UTMify] Daily campaign sync error:", err);
      }

      results.push({
        dashboard: dashboard.name,
        status: "ok",
        dailySnapshots,
        ...(campaignsError ? { campaignsError } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[UTMify Sync] Error for ${dashboard.name}:`, message);
      results.push({ dashboard: dashboard.name, status: "error", error: message });
    }
  }

  // Single batch insert per entity type — one round-trip instead of N.
  // onConflictDoNothing() usa os índices parciais criados na migration 0006:
  //   - metrics_snapshots_utmify_dashboard_uniq      (date, utmify_dashboard_id) WHERE entity_type='dashboard'
  //   - metrics_snapshots_utmify_campaign_daily_uniq (date, utmify_campaign_id)  WHERE entity_type='utmify_campaign_daily'
  // Retries automáticos do Vercel (ou execuções manuais do mesmo dia) são seguros.
  if (dashboardRows.length > 0) {
    await db.insert(metricsSnapshots).values(dashboardRows).onConflictDoNothing();
  }
  if (campaignRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < campaignRows.length; i += CHUNK) {
      await db.insert(metricsSnapshots).values(campaignRows.slice(i, i + CHUNK)).onConflictDoNothing();
    }
  }

  return NextResponse.json({
    // Sucesso real: pelo menos 1 dashboard sincronizou (nunca fixo). Falha isolada de
    // campanhas (campaignsError por item) não derruba isso — já está sinalizada acima.
    success: results.some((r) => r.status === "ok"),
    syncedAt: new Date().toISOString(),
    snapshotDate: yesterday.toISOString(),
    results,
  });
}
