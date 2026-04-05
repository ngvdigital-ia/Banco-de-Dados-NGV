"use server";

import { db } from "@/db";
import { vsls, creatives, campaigns, projects, teamMembers, metricsSnapshots } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

// ========== VSL COMPARISON ==========

export async function getVslsForComparison() {
  return db
    .select({
      id: vsls.id,
      version: vsls.version,
      projectId: vsls.projectId,
      projectName: projects.name,
      copywriterName: teamMembers.name,
      duration: vsls.duration,
      priceRevealSecond: vsls.priceRevealSecond,
      backRedirectActive: vsls.backRedirectActive,
      status: vsls.status,
      createdAt: vsls.createdAt,
    })
    .from(vsls)
    .innerJoin(projects, eq(vsls.projectId, projects.id))
    .leftJoin(teamMembers, eq(vsls.copywriterId, teamMembers.id))
    .orderBy(projects.name, vsls.version);
}

// ========== CREATIVES BY FORMAT ==========

export async function getCreativesByFormat() {
  return db
    .select({
      format: creatives.format,
      platform: creatives.platform,
      count: sql<number>`count(*)`,
    })
    .from(creatives)
    .groupBy(creatives.format, creatives.platform)
    .orderBy(sql`count(*) desc`);
}

export async function getCreativesDetailed() {
  return db
    .select({
      id: creatives.id,
      format: creatives.format,
      platform: creatives.platform,
      status: creatives.status,
      projectName: projects.name,
      copywriterName: sql<string | null>`cw.name`,
      editorName: sql<string | null>`ed.name`,
      createdAt: creatives.createdAt,
    })
    .from(creatives)
    .innerJoin(projects, eq(creatives.projectId, projects.id))
    .leftJoin(sql`${teamMembers} as cw`, sql`cw.id = ${creatives.copywriterId}`)
    .leftJoin(sql`${teamMembers} as ed`, sql`ed.id = ${creatives.editorId}`)
    .orderBy(desc(creatives.createdAt));
}

// ========== TEAM PERFORMANCE ==========

export async function getTeamPerformance() {
  const members = await db.select().from(teamMembers).where(eq(teamMembers.active, true));

  const results = [];

  for (const member of members) {
    let vslCount = 0;
    let creativesCopyCount = 0;
    let creativesEditCount = 0;
    let campaignCount = 0;

    if (member.role === "copywriter" || member.role === "admin") {
      const [v] = await db
        .select({ count: sql<number>`count(*)` })
        .from(vsls)
        .where(eq(vsls.copywriterId, member.id));
      vslCount = Number(v.count);

      const [cc] = await db
        .select({ count: sql<number>`count(*)` })
        .from(creatives)
        .where(eq(creatives.copywriterId, member.id));
      creativesCopyCount = Number(cc.count);
    }

    if (member.role === "editor" || member.role === "admin") {
      const [ce] = await db
        .select({ count: sql<number>`count(*)` })
        .from(creatives)
        .where(eq(creatives.editorId, member.id));
      creativesEditCount = Number(ce.count);
    }

    if (member.role === "gestor_trafego" || member.role === "admin") {
      const [c] = await db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(eq(campaigns.managerId, member.id));
      campaignCount = Number(c.count);
    }

    results.push({
      id: member.id,
      name: member.name,
      role: member.role,
      vslCount,
      creativesCopyCount,
      creativesEditCount,
      campaignCount,
      totalOutput: vslCount + creativesCopyCount + creativesEditCount + campaignCount,
    });
  }

  return results.sort((a, b) => b.totalOutput - a.totalOutput);
}

// ========== OFFERS RANKING ==========

export async function getOffersRanking() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      niche: projects.niche,
      language: projects.language,
      status: projects.status,
      vslCount: sql<number>`(SELECT count(*) FROM vsls WHERE vsls.project_id = ${projects.id})`,
      creativeCount: sql<number>`(SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id})`,
      campaignCount: sql<number>`(SELECT count(*) FROM campaigns WHERE campaigns.project_id = ${projects.id})`,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt));
}
