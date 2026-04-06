"use server";

import { db } from "@/db";
import { projects, teamMembers, vsls, creatives, campaigns, metricsSnapshots } from "@/db/schema";
import { eq, sql, desc, gte } from "drizzle-orm";

export async function getDashboardStats() {
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects);

  const [activeProjectCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(eq(projects.status, "rodando"));

  const [teamCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(eq(teamMembers.active, true));

  const [vslCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(vsls);

  const [creativeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(creatives);

  const [campaignCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns);

  return {
    totalProjects: Number(projectCount.count),
    activeProjects: Number(activeProjectCount.count),
    teamSize: Number(teamCount.count),
    totalVsls: Number(vslCount.count),
    totalCreatives: Number(creativeCount.count),
    totalCampaigns: Number(campaignCount.count),
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

export async function getVturbSummary() {
  const rows = await db
    .select({
      extraData: metricsSnapshots.extraData,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "vturb_player"));

  type VturbEvent = {
    player_id: string;
    event: string;
    total: number;
  };

  type VturbExtraData = {
    playerId: string;
    playerName: string;
    events: VturbEvent[];
  };

  let totalPlays = 0;
  let totalViews = 0;
  let totalFinishes = 0;
  let totalClicks = 0;

  const playerList: { name: string; plays: number }[] = [];

  for (const row of rows) {
    const data = row.extraData as VturbExtraData | null;
    if (!data?.playerId || !data?.events) continue;

    const playerEvents = data.events.filter(
      (e) => e.player_id === data.playerId
    );

    const started = playerEvents.find((e) => e.event === "started")?.total ?? 0;
    const finished = playerEvents.find((e) => e.event === "finished")?.total ?? 0;
    const viewed = playerEvents.find((e) => e.event === "viewed")?.total ?? 0;
    const clicked = playerEvents.find((e) => e.event === "clicked")?.total ?? 0;

    totalPlays += started;
    totalViews += viewed;
    totalFinishes += finished;
    totalClicks += clicked;

    playerList.push({ name: data.playerName, plays: started });
  }

  const avgPlayRate = totalViews > 0 ? Math.round((totalPlays / totalViews) * 10000) / 100 : 0;
  const avgFinishRate = totalPlays > 0 ? Math.round((totalFinishes / totalPlays) * 10000) / 100 : 0;

  const topPlayers = playerList
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  return {
    totalPlays,
    totalViews,
    totalFinishes,
    totalClicks,
    avgPlayRate,
    avgFinishRate,
    topPlayers,
  };
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
    .where(gte(metricsSnapshots.date, since))
    .groupBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`);

  return rows.map((r) => ({
    date: r.date,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
    roas: Number(r.roas),
  }));
}
