"use server";

import { db } from "@/db";
import { projects, vsls, creatives, campaigns, teamMembers, metricsSnapshots } from "@/db/schema";
import { eq, sql, desc, and, inArray } from "drizzle-orm";

// ========== TYPES ==========

export type AnalyticsFilters = {
  niches?: string[];
  languages?: string[];
  copywriterIds?: number[];
  editorIds?: number[];
  formats?: string[];
  statuses?: string[];
};

export type ComparisonData = {
  label: string;
  totalCreatives: number;
  totalVsls: number;
  pctEscalou: number;
  pctValidou: number;
  pctNaoValidou: number;
};

// ========== FILTER OPTIONS ==========

export async function getFilterOptions() {
  const [nicheRows, languageRows, copywriters, editors, formatRows] = await Promise.all([
    db
      .selectDistinct({ niche: projects.niche })
      .from(projects)
      .orderBy(projects.niche),
    db
      .selectDistinct({ language: projects.language })
      .from(projects)
      .orderBy(projects.language),
    db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.active, true),
          sql`${teamMembers.role} IN ('copywriter', 'admin')`
        )
      )
      .orderBy(teamMembers.name),
    db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.active, true),
          sql`${teamMembers.role} IN ('editor', 'admin')`
        )
      )
      .orderBy(teamMembers.name),
    db
      .selectDistinct({ format: creatives.format })
      .from(creatives)
      .orderBy(creatives.format),
  ]);

  return {
    niches: nicheRows.map((r) => r.niche),
    languages: languageRows.map((r) => r.language),
    copywriters,
    editors,
    formats: formatRows.map((r) => r.format),
  };
}

// ========== HELPERS ==========

/**
 * Build an array of SQL conditions for project-level filters.
 * Expects the projects table to already be part of the query (joined or main).
 */
function buildProjectConditions(filters?: AnalyticsFilters) {
  const conditions = [];

  if (filters?.niches && filters.niches.length > 0) {
    conditions.push(inArray(projects.niche, filters.niches));
  }

  if (filters?.languages && filters.languages.length > 0) {
    conditions.push(inArray(projects.language, filters.languages));
  }

  if (filters?.statuses && filters.statuses.length > 0) {
    const vals = filters.statuses.map((s) => `'${s}'`).join(",");
    conditions.push(sql`${projects.status} IN (${sql.raw(vals)})`);
  }

  return conditions;
}

/**
 * Build conditions for creative-specific filters (copywriter, editor, format, status).
 */
function buildCreativeConditions(filters?: AnalyticsFilters) {
  const conditions = [];

  if (filters?.copywriterIds && filters.copywriterIds.length > 0) {
    conditions.push(inArray(creatives.copywriterId, filters.copywriterIds));
  }

  if (filters?.editorIds && filters.editorIds.length > 0) {
    conditions.push(inArray(creatives.editorId, filters.editorIds));
  }

  if (filters?.formats && filters.formats.length > 0) {
    const vals = filters.formats.map((f) => `'${f}'`).join(",");
    conditions.push(sql`${creatives.format} IN (${sql.raw(vals)})`);
  }

  if (filters?.statuses && filters.statuses.length > 0) {
    const vals = filters.statuses.map((s) => `'${s}'`).join(",");
    conditions.push(sql`${creatives.status} IN (${sql.raw(vals)})`);
  }

  return conditions;
}

/**
 * Combine all conditions with `and()`, returning undefined if none.
 */
function combineConditions(conditions: unknown[]) {
  if (conditions.length === 0) return sql`1=1`;
  if (conditions.length === 1) return conditions[0] as ReturnType<typeof eq>;
  return and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]));
}

// ========== VSL COMPARISON ==========

export async function getVslsForComparison(filters?: AnalyticsFilters) {
  const conditions = [
    ...buildProjectConditions(filters),
  ];

  if (filters?.copywriterIds && filters.copywriterIds.length > 0) {
    conditions.push(inArray(vsls.copywriterId, filters.copywriterIds));
  }

  const whereClause = combineConditions(conditions);

  const rows = await db
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
    .where(whereClause)
    .orderBy(projects.name, vsls.version);

  // Calculate summary stats per project
  const byProject = new Map<
    number,
    { count: number; totalDuration: number; totalPriceReveal: number; validDurations: number; validPriceReveals: number }
  >();

  for (const row of rows) {
    const existing = byProject.get(row.projectId) ?? {
      count: 0,
      totalDuration: 0,
      totalPriceReveal: 0,
      validDurations: 0,
      validPriceReveals: 0,
    };
    existing.count += 1;
    if (row.duration != null) {
      existing.totalDuration += row.duration;
      existing.validDurations += 1;
    }
    if (row.priceRevealSecond != null) {
      existing.totalPriceReveal += row.priceRevealSecond;
      existing.validPriceReveals += 1;
    }
    byProject.set(row.projectId, existing);
  }

  return rows.map((row) => {
    const stats = byProject.get(row.projectId) ?? {
      count: 0, totalDuration: 0, totalPriceReveal: 0, validDurations: 0, validPriceReveals: 0,
    };
    return {
      ...row,
      projectVslCount: stats.count,
      avgDuration: stats.validDurations > 0 ? Math.round(stats.totalDuration / stats.validDurations) : null,
      avgPriceRevealSecond:
        stats.validPriceReveals > 0 ? Math.round(stats.totalPriceReveal / stats.validPriceReveals) : null,
    };
  });
}

// ========== CREATIVES BY FORMAT ==========

export async function getCreativesByFormat(filters?: AnalyticsFilters) {
  const conditions = [
    ...buildProjectConditions(filters),
    ...buildCreativeConditions(filters),
  ];

  const whereClause = combineConditions(conditions);

  return db
    .select({
      format: creatives.format,
      platform: creatives.platform,
      count: sql<number>`count(*)`,
      countEscalou: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
      countValidou: sql<number>`count(*) filter (where ${creatives.status} = 'validou')`,
      countNaoValidou: sql<number>`count(*) filter (where ${creatives.status} = 'nao_validou')`,
      pctEscalou: sql<number>`round(100.0 * count(*) filter (where ${creatives.status} = 'escalou') / nullif(count(*), 0), 2)`,
      pctValidou: sql<number>`round(100.0 * count(*) filter (where ${creatives.status} = 'validou') / nullif(count(*), 0), 2)`,
      pctNaoValidou: sql<number>`round(100.0 * count(*) filter (where ${creatives.status} = 'nao_validou') / nullif(count(*), 0), 2)`,
    })
    .from(creatives)
    .innerJoin(projects, eq(creatives.projectId, projects.id))
    .where(whereClause)
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

export async function getTeamPerformance(filters?: AnalyticsFilters) {
  const members = await db.select().from(teamMembers).where(eq(teamMembers.active, true));

  const projectConditions = buildProjectConditions(filters);
  const hasProjectFilter = projectConditions.length > 0;

  const results = [];

  for (const member of members) {
    let vslCount = 0;
    let creativesCopyCount = 0;
    let creativesEditCount = 0;
    let campaignCount = 0;
    let creativesEscalouCount = 0;
    let creativesTotalForConversion = 0;

    if (member.role === "copywriter" || member.role === "admin") {
      // VSL count with optional project filter
      if (hasProjectFilter) {
        const [v] = await db
          .select({ count: sql<number>`count(*)` })
          .from(vsls)
          .innerJoin(projects, eq(vsls.projectId, projects.id))
          .where(combineConditions([eq(vsls.copywriterId, member.id), ...projectConditions]));
        vslCount = Number(v.count);
      } else {
        const [v] = await db
          .select({ count: sql<number>`count(*)` })
          .from(vsls)
          .where(eq(vsls.copywriterId, member.id));
        vslCount = Number(v.count);
      }

      // Creatives as copywriter with optional project filter
      if (hasProjectFilter) {
        const [cc] = await db
          .select({
            count: sql<number>`count(*)`,
            escalouCount: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
          })
          .from(creatives)
          .innerJoin(projects, eq(creatives.projectId, projects.id))
          .where(combineConditions([eq(creatives.copywriterId, member.id), ...projectConditions]));
        creativesCopyCount = Number(cc.count);
        creativesEscalouCount += Number(cc.escalouCount);
        creativesTotalForConversion += Number(cc.count);
      } else {
        const [cc] = await db
          .select({
            count: sql<number>`count(*)`,
            escalouCount: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
          })
          .from(creatives)
          .where(eq(creatives.copywriterId, member.id));
        creativesCopyCount = Number(cc.count);
        creativesEscalouCount += Number(cc.escalouCount);
        creativesTotalForConversion += Number(cc.count);
      }
    }

    if (member.role === "editor" || member.role === "admin") {
      if (hasProjectFilter) {
        const [ce] = await db
          .select({
            count: sql<number>`count(*)`,
            escalouCount: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
          })
          .from(creatives)
          .innerJoin(projects, eq(creatives.projectId, projects.id))
          .where(combineConditions([eq(creatives.editorId, member.id), ...projectConditions]));
        creativesEditCount = Number(ce.count);
        creativesEscalouCount += Number(ce.escalouCount);
        creativesTotalForConversion += Number(ce.count);
      } else {
        const [ce] = await db
          .select({
            count: sql<number>`count(*)`,
            escalouCount: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
          })
          .from(creatives)
          .where(eq(creatives.editorId, member.id));
        creativesEditCount = Number(ce.count);
        creativesEscalouCount += Number(ce.escalouCount);
        creativesTotalForConversion += Number(ce.count);
      }
    }

    if (member.role === "gestor_trafego" || member.role === "admin") {
      if (hasProjectFilter) {
        const [c] = await db
          .select({ count: sql<number>`count(*)` })
          .from(campaigns)
          .innerJoin(projects, eq(campaigns.projectId, projects.id))
          .where(combineConditions([eq(campaigns.managerId, member.id), ...projectConditions]));
        campaignCount = Number(c.count);
      } else {
        const [c] = await db
          .select({ count: sql<number>`count(*)` })
          .from(campaigns)
          .where(eq(campaigns.managerId, member.id));
        campaignCount = Number(c.count);
      }
    }

    const totalOutput = vslCount + creativesCopyCount + creativesEditCount + campaignCount;
    const pctEscalou =
      creativesTotalForConversion > 0
        ? Math.round((creativesEscalouCount / creativesTotalForConversion) * 10000) / 100
        : 0;

    results.push({
      id: member.id,
      name: member.name,
      role: member.role,
      vslCount,
      creativesCopyCount,
      creativesEditCount,
      campaignCount,
      totalOutput,
      creativesEscalouCount,
      pctEscalou,
      clickupTasks: 0,
    });
  }

  // Fetch ClickUp task counts from metricsSnapshots
  const clickupRows = await db
    .select({
      entityId: metricsSnapshots.entityId,
      extraData: metricsSnapshots.extraData,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "clickup_member"))
    .orderBy(desc(metricsSnapshots.createdAt));

  // Build a map of clickup member name → latest task count
  const clickupByName = new Map<string, number>();
  for (const row of clickupRows) {
    const data = row.extraData as { memberName?: string; taskCount?: number } | null;
    if (data?.memberName && !clickupByName.has(data.memberName.toLowerCase())) {
      clickupByName.set(data.memberName.toLowerCase(), data.taskCount ?? 0);
    }
  }

  // Match ClickUp members to team members by name (case-insensitive, first name match)
  for (const member of results) {
    const memberFirstName = member.name.split(" ")[0].toLowerCase();
    for (const [clickupName, count] of clickupByName) {
      if (clickupName.toLowerCase().includes(memberFirstName) || memberFirstName.includes(clickupName.split(" ")[0].toLowerCase())) {
        member.clickupTasks = count;
        break;
      }
    }
  }

  return results.sort((a, b) => b.totalOutput - a.totalOutput);
}

// ========== OFFERS RANKING ==========

export async function getOffersRanking(filters?: AnalyticsFilters) {
  const conditions = buildProjectConditions(filters);
  const whereClause = combineConditions(conditions);

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
      creativesEscalou: sql<number>`(SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id} AND creatives.status = 'escalou')`,
      creativesValidou: sql<number>`(SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id} AND creatives.status = 'validou')`,
      creativesNaoValidou: sql<number>`(SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id} AND creatives.status = 'nao_validou')`,
      pctEscalou: sql<number>`round(100.0 * (SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id} AND creatives.status = 'escalou') / nullif((SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id}), 0), 2)`,
      pctValidou: sql<number>`round(100.0 * (SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id} AND creatives.status = 'validou') / nullif((SELECT count(*) FROM creatives WHERE creatives.project_id = ${projects.id}), 0), 2)`,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(whereClause)
    .orderBy(desc(projects.createdAt));
}

// ========== VTURB STATS ==========

export async function getVturbStats() {
  // Limit to 50 to avoid exceeding Neon response size
  const rows = await db
    .select({
      extraData: metricsSnapshots.extraData,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "vturb_player"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(50);

  type VturbData = {
    playerId: string;
    playerName: string;
    started: number;
    finished: number;
    viewed: number;
    clicked: number;
    playRate?: number;
    finishRate?: number;
  };

  const playerStats: {
    playerName: string;
    started: number;
    finished: number;
    viewed: number;
    clicked: number;
    playRate: number;
    finishRate: number;
  }[] = [];

  for (const row of rows) {
    const data = row.extraData as VturbData | null;
    if (!data?.playerId) continue;

    const started = data.started ?? 0;
    const finished = data.finished ?? 0;
    const viewed = data.viewed ?? 0;
    const clicked = data.clicked ?? 0;

    const playRate = data.playRate ?? (viewed > 0 ? (started / viewed) * 100 : 0);
    const finishRate = data.finishRate ?? (started > 0 ? (finished / started) * 100 : 0);

    playerStats.push({
      playerName: data.playerName,
      started,
      finished,
      viewed,
      clicked,
      playRate: Math.round(playRate * 100) / 100,
      finishRate: Math.round(finishRate * 100) / 100,
    });
  }

  return playerStats
    .sort((a, b) => b.started - a.started)
    .slice(0, 50);
}

// ========== COMPARISON DATA ==========

export async function getComparisonData(
  dimension: "niche" | "language" | "copywriter" | "editor",
  values: [string, string],
  filters?: AnalyticsFilters
) {
  const results: ComparisonData[] = [];

  for (const value of values) {
    let label = value;
    let creativesWhereConditions: unknown[] = [];
    let vslsWhereConditions: unknown[] = [];

    // Base project-level filters from baseFilters
    const projectConds = buildProjectConditions(filters);

    // Base creative-level filters (copywriterIds, editorIds) from baseFilters
    const baseCreativeConds = buildCreativeConditions(filters);

    // Base VSL-level conditions from filters (copywriterIds apply to VSLs too)
    const baseVslConds: unknown[] = [];
    if (filters?.copywriterIds && filters.copywriterIds.length > 0) {
      baseVslConds.push(inArray(vsls.copywriterId, filters.copywriterIds));
    }

    switch (dimension) {
      case "niche": {
        // Remove niche filter from projectConds since we override it with the specific value
        const filteredProjectConds = filters?.niches?.length
          ? projectConds.filter((c) => c !== inArray(projects.niche, filters.niches!))
          : projectConds;
        creativesWhereConditions = [
          ...filteredProjectConds,
          ...baseCreativeConds,
          eq(projects.niche, value),
        ];
        vslsWhereConditions = [
          ...filteredProjectConds,
          ...baseVslConds,
          eq(projects.niche, value),
        ];
        break;
      }
      case "language": {
        const filteredProjectConds = filters?.languages?.length
          ? projectConds.filter((c) => c !== inArray(projects.language, filters.languages!))
          : projectConds;
        creativesWhereConditions = [
          ...filteredProjectConds,
          ...baseCreativeConds,
          eq(projects.language, value),
        ];
        vslsWhereConditions = [
          ...filteredProjectConds,
          ...baseVslConds,
          eq(projects.language, value),
        ];
        break;
      }
      case "copywriter": {
        const memberId = parseInt(value, 10);
        // Resolve name for label
        const [member] = await db
          .select({ name: teamMembers.name })
          .from(teamMembers)
          .where(eq(teamMembers.id, memberId));
        if (member) label = member.name;

        // Remove copywriterIds from base creative conditions since we override it
        const filteredCreativeConds = filters?.copywriterIds?.length
          ? baseCreativeConds.filter((c) => c !== inArray(creatives.copywriterId, filters.copywriterIds!))
          : baseCreativeConds;

        creativesWhereConditions = [...projectConds, ...filteredCreativeConds, eq(creatives.copywriterId, memberId)];
        vslsWhereConditions = [...projectConds, eq(vsls.copywriterId, memberId)];
        break;
      }
      case "editor": {
        const memberId = parseInt(value, 10);
        const [member] = await db
          .select({ name: teamMembers.name })
          .from(teamMembers)
          .where(eq(teamMembers.id, memberId));
        if (member) label = member.name;

        // Remove editorIds from base creative conditions since we override it
        const filteredCreativeConds = filters?.editorIds?.length
          ? baseCreativeConds.filter((c) => c !== inArray(creatives.editorId, filters.editorIds!))
          : baseCreativeConds;

        creativesWhereConditions = [...projectConds, ...filteredCreativeConds, eq(creatives.editorId, memberId)];
        vslsWhereConditions = [...projectConds, ...baseVslConds];
        break;
      }
    }

    // Creatives stats
    const [creativesStats] = await db
      .select({
        total: sql<number>`count(*)`,
        escalou: sql<number>`count(*) filter (where ${creatives.status} = 'escalou')`,
        validou: sql<number>`count(*) filter (where ${creatives.status} = 'validou')`,
        naoValidou: sql<number>`count(*) filter (where ${creatives.status} = 'nao_validou')`,
      })
      .from(creatives)
      .innerJoin(projects, eq(creatives.projectId, projects.id))
      .where(combineConditions(creativesWhereConditions));

    // VSLs count
    const [vslStats] = await db
      .select({ total: sql<number>`count(*)` })
      .from(vsls)
      .innerJoin(projects, eq(vsls.projectId, projects.id))
      .where(combineConditions(vslsWhereConditions));

    const totalCreatives = Number(creativesStats.total);
    const totalVsls = Number(vslStats.total);
    const escalou = Number(creativesStats.escalou);
    const validou = Number(creativesStats.validou);
    const naoValidou = Number(creativesStats.naoValidou);

    results.push({
      label,
      totalCreatives,
      totalVsls,
      pctEscalou: totalCreatives > 0 ? Math.round((escalou / totalCreatives) * 10000) / 100 : 0,
      pctValidou: totalCreatives > 0 ? Math.round((validou / totalCreatives) * 10000) / 100 : 0,
      pctNaoValidou: totalCreatives > 0 ? Math.round((naoValidou / totalCreatives) * 10000) / 100 : 0,
    });
  }

  return results;
}
