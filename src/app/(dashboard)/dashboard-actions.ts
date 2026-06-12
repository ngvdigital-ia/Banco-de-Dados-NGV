"use server";

import { db } from "@/db";
import { projects, teamMembers, vsls, creatives, campaigns, metricsSnapshots, offerTracking } from "@/db/schema";
import { and, eq, sql, desc, gte } from "drizzle-orm";
import { fetchEventsByPlayer, fetchPlayers, fetchSessionStats } from "@/lib/vturb";
import { unstable_cache } from "next/cache";

export async function getDashboardStats() {
  // Consolidar as 5 queries de offerTracking em 1 + teamMembers separada, ambas em paralelo
  const [offerStats, teamResult] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${offerTracking.validation} = 'EM ANDAMENTO')`,
        vslCount: sql<number>`count(*) filter (where ${offerTracking.copyVslStatus} = 'SIM')`,
        campaigns: sql<number>`count(*) filter (where ${offerTracking.campaignsActive} = 'SIM')`,
        creatives: sql<number>`coalesce(sum(${offerTracking.adsEditedCount}), 0)`,
      })
      .from(offerTracking),
    db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.active, true)),
  ]);

  const stats = offerStats[0];
  const [teamCount] = teamResult;

  return {
    totalProjects: Number(stats.total),
    activeProjects: Number(stats.active),
    teamSize: Number(teamCount.count),
    totalVsls: Number(stats.vslCount),
    totalCreatives: Number(stats.creatives),
    totalCampaigns: Number(stats.campaigns),
  };
}

export async function getRecentMetrics() {
  return db
    .select()
    .from(metricsSnapshots)
    .orderBy(desc(metricsSnapshots.date))
    .limit(30);
}

export async function getProjectsSummary() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      niche: projects.niche,
      language: projects.language,
      status: projects.status,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(10);
}

// Função interna — envolvida em unstable_cache abaixo (TTL 300s, tag "vturb-summary").
async function _getVturbSummary() {

  // Fetch live data from VTurb API (last 30 days)
  const now = new Date();
  const ago = new Date(now);
  ago.setDate(ago.getDate() - 30);
  const dateFrom = ago.toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];

  // Fetch ALL players (no date filter — date filter restricts by creation date, not activity)
  const playersResult = await fetchPlayers();
  const players = playersResult?.players ?? [];
  const playerIds = players.map((p) => p.id);

  // Fetch events for all players in one bulk call
  const eventsMap = playerIds.length > 0
    ? await fetchEventsByPlayer(playerIds, dateFrom, dateTo)
    : null;

  let totalPlays = 0;
  let totalViews = 0;
  let totalFinishes = 0;
  let totalClicks = 0;

  const playerList: { id: string; name: string; plays: number }[] = [];

  for (const player of players) {
    const events = eventsMap?.get(player.id);
    const started = events?.started ?? 0;
    const finished = events?.finished ?? 0;
    const viewed = events?.viewed ?? 0;
    const clicked = events?.clicked ?? 0;

    totalPlays += started;
    totalViews += viewed;
    totalFinishes += finished;
    totalClicks += clicked;

    if (started > 0) {
      playerList.push({ id: player.id, name: player.name, plays: started });
    }
  }

  const avgPlayRate = totalViews > 0 ? Math.round((totalPlays / totalViews) * 10000) / 100 : 0;
  const avgFinishRate = totalPlays > 0 ? Math.round((totalFinishes / totalPlays) * 10000) / 100 : 0;

  // Fetch real pitch retention from session stats for top 10 active players
  const topForPitch = playerList
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  let avgPitchRetention: number | null = null;

  if (topForPitch.length > 0) {
    const sessionResults = await Promise.allSettled(
      topForPitch.map((p) => fetchSessionStats(p.id, dateFrom, dateTo))
    );

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < sessionResults.length; i++) {
      const result = sessionResults[i];
      if (result.status === "fulfilled" && result.value?.over_pitch_rate != null) {
        const rate = parseFloat(String(result.value.over_pitch_rate));
        if (!isNaN(rate)) {
          weightedSum += rate * topForPitch[i].plays;
          totalWeight += topForPitch[i].plays;
        }
      }
    }

    if (totalWeight > 0) {
      avgPitchRetention = Math.round((weightedSum / totalWeight) * 100) / 100;
    }
  }

  const topPlayers = playerList.slice(0, 5).map((p) => ({ name: p.name, plays: p.plays }));

  return {
    totalPlays,
    totalViews,
    totalFinishes,
    totalClicks,
    avgPlayRate,
    avgFinishRate,
    avgPitchRetention,
    topPlayers,
  };
}

// Wrapper cacheado — TTL 300s, tag "vturb-summary" para invalidação on-demand.
export const getVturbSummary = unstable_cache(
  _getVturbSummary,
  ["vturb-summary"],
  { revalidate: 300, tags: ["vturb-summary"] },
);

export async function getLatestUtmifySummary() {
  // Read latest UTMify offer data from DB (saved via MCP)
  const rows = await db
    .select({ extraData: metricsSnapshots.extraData, spend: metricsSnapshots.spend, revenue: metricsSnapshots.revenue })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "utmify_offer"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(20);

  type OfferData = { offerName: string; spend: number; revenue: number; profit: number; currency?: string };
  const seen = new Set<string>();
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let currency = "USD";

  for (const row of rows) {
    const data = row.extraData as OfferData | null;
    if (!data?.offerName || seen.has(data.offerName)) continue;
    seen.add(data.offerName);
    totalSpend += data.spend ?? 0;
    totalRevenue += data.revenue ?? 0;
    totalProfit += data.profit ?? 0;
    if (data.currency) currency = data.currency;
  }

  if (seen.size === 0) return null;
  return { totalSpend, totalRevenue, totalProfit, currency, offersCount: seen.size };
}

export async function getMetricsTrend(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`,
      spend: sql<string>`coalesce(sum(${metricsSnapshots.spend}), 0)`,
      revenue: sql<string>`coalesce(sum(${metricsSnapshots.revenue}), 0)`,
      roas: sql<string>`case when coalesce(sum(${metricsSnapshots.spend}), 0) = 0 then 0 else coalesce(sum(${metricsSnapshots.revenue}), 0) / sum(${metricsSnapshots.spend}) end`,
    })
    .from(metricsSnapshots)
    // BUGFIX: sem este filtro o trend somava revenue de TODOS os entity_types
    // (vendas + campanhas + dashboard) sobre spend só de campanha → ROAS errado.
    // O gráfico da home é de MÍDIA: só utmify_campaign_daily.
    .where(and(gte(metricsSnapshots.date, since), eq(metricsSnapshots.entityType, "utmify_campaign_daily")))
    .groupBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`);

  return rows.map((r) => ({
    date: r.date,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
    roas: Number(r.roas),
  }));
}
