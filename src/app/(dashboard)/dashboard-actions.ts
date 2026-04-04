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
