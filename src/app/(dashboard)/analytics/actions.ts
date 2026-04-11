"use server";

import { db } from "@/db";
import { projects, vsls, creatives, campaigns, teamMembers, metricsSnapshots, offerTracking } from "@/db/schema";
import { fieldContainsMember, fieldMatchesMember, getMemberAliases } from "@/lib/team-utils";
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
          sql`${teamMembers.role}::text IN ('copywriter', 'admin')`
        )
      )
      .orderBy(teamMembers.name),
    db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.active, true),
          sql`${teamMembers.role}::text IN ('editor', 'admin')`
        )
      )
      .orderBy(teamMembers.name),
    db
      .selectDistinct({ format: offerTracking.adFormat })
      .from(offerTracking)
      .where(sql`${offerTracking.adFormat} IS NOT NULL`),
  ]);

  return {
    niches: nicheRows.map((r) => r.niche),
    languages: languageRows.map((r) => r.language),
    copywriters,
    editors,
    formats: formatRows.map((r) => r.format).filter(Boolean) as string[],
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
    conditions.push(sql`${projects.status}::text IN (${sql.join(filters.statuses.map(s => sql`${s}`), sql`, `)})`);
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
    conditions.push(sql`${creatives.format}::text IN (${sql.join(filters.formats.map(f => sql`${f}`), sql`, `)})`);
  }

  if (filters?.statuses && filters.statuses.length > 0) {
    conditions.push(sql`${creatives.status}::text IN (${sql.join(filters.statuses.map(s => sql`${s}`), sql`, `)})`);
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

export async function getCreativesByFormat() {
  // Query offerTracking grouped by adFormat (includes offers without format as "sem_formato")
  return db
    .select({
      format: sql<string>`coalesce(${offerTracking.adFormat}::text, 'sem_formato')`,
      platform: sql<string | null>`null`,
      count: sql<number>`count(*)`,
      countEscalou: sql<number>`count(*) filter (where ${offerTracking.validation} = 'SIM' and (${offerTracking.scale} = 'SIM' or ${offerTracking.scale} = 'EM ANDAMENTO'))`,
      countValidou: sql<number>`count(*) filter (where ${offerTracking.validation} = 'SIM')`,
      countNaoValidou: sql<number>`count(*) filter (where ${offerTracking.validation} in ('NAO', 'NÃO DEU CERTO'))`,
      pctEscalou: sql<number>`round(100.0 * count(*) filter (where ${offerTracking.validation} = 'SIM' and (${offerTracking.scale} = 'SIM' or ${offerTracking.scale} = 'EM ANDAMENTO')) / nullif(count(*), 0), 2)`,
      pctValidou: sql<number>`round(100.0 * count(*) filter (where ${offerTracking.validation} = 'SIM') / nullif(count(*), 0), 2)`,
      pctNaoValidou: sql<number>`round(100.0 * count(*) filter (where ${offerTracking.validation} in ('NAO', 'NÃO DEU CERTO')) / nullif(count(*), 0), 2)`,
    })
    .from(offerTracking)
    .groupBy(sql`coalesce(${offerTracking.adFormat}::text, 'sem_formato')`)
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
  // Fetch team members and all offer tracking data in parallel
  const [members, allOffers] = await Promise.all([
    db.select().from(teamMembers).where(eq(teamMembers.active, true)),
    db.select().from(offerTracking),
  ]);

  const results = [];

  for (const member of members) {
    const aliases = getMemberAliases(member.name);

    let vslCount = 0;
    let creativesCopyCount = 0;
    let creativesEditCount = 0;
    let campaignCount = 0;
    let creativesEscalouCount = 0;

    for (const offer of allOffers) {
      const isVslCopy = fieldMatchesMember(offer.copyVsl, member.name);
      const isCopyAds = fieldContainsMember(offer.copyAds, member.name);
      const isEditorAds = fieldContainsMember(offer.editorAds, member.name);
      const isEditorVsl = fieldContainsMember(offer.editorVsl, member.name);
      const isEscalou = offer.validation === "SIM" && (offer.scale === "SIM" || offer.scale === "EM ANDAMENTO");

      // Copywriter metrics
      if (member.role === "copywriter" || member.role === "admin") {
        if (isVslCopy) vslCount++;
        if (isCopyAds) {
          // Sum from adsCopyByPerson JSONB if available
          const personData = offer.adsCopyByPerson as Record<string, number> | null;
          if (personData) {
            for (const [k, v] of Object.entries(personData)) {
              if (aliases.some((a) => a === k.toUpperCase())) {
                creativesCopyCount += v;
                break;
              }
            }
          }
        }
      }

      // Editor metrics
      if (member.role === "editor" || member.role === "admin") {
        if (isEditorAds || isEditorVsl) {
          creativesEditCount++;
          if (isEscalou) creativesEscalouCount++;
        }
      }

      // Traffic manager
      if (member.role === "gestor_trafego" || member.role === "admin") {
        if (offer.campaignsActive === "SIM") campaignCount++;
      }
    }

    const totalOutput = vslCount + creativesCopyCount + creativesEditCount + campaignCount;
    const pctEscalou = creativesEditCount > 0
      ? Math.round((creativesEscalouCount / creativesEditCount) * 10000) / 100
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
      clickupByCategory: {} as Record<string, number>,
      clickupOnTimePct: null as number | null,
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

  type ClickUpData = {
    memberName?: string;
    tasksCompleted?: number;
    taskCount?: number;
    tasksByCategory?: Record<string, number>;
    pctOnTime?: number | null;
  };

  const clickupByName = new Map<string, { count: number; byCategory: Record<string, number>; pctOnTime: number | null }>();
  for (const row of clickupRows) {
    const data = row.extraData as ClickUpData | null;
    if (data?.memberName && !clickupByName.has(data.memberName.toLowerCase())) {
      clickupByName.set(data.memberName.toLowerCase(), {
        count: data.tasksCompleted ?? data.taskCount ?? 0,
        byCategory: data.tasksByCategory ?? {},
        pctOnTime: data.pctOnTime ?? null,
      });
    }
  }

  // Match ClickUp members using aliases (handles Malu↔Maria Luisa, etc.)
  // Build a map of clickup name → best matching team member
  for (const member of results) {
    const aliases = getMemberAliases(member.name).map((a) => a.toLowerCase());
    for (const [clickupName, data] of clickupByName) {
      const clickupLower = clickupName.toLowerCase();
      const clickupParts = clickupLower.split(/\s+/);

      // Precise matching: check if any alias matches the clickup name exactly or as first/full name
      const matched = aliases.some((alias) => {
        const aliasLower = alias.toLowerCase();
        // Exact full match
        if (clickupLower === aliasLower) return true;
        // ClickUp first name matches alias exactly
        if (clickupParts[0] === aliasLower) return true;
        // Alias is a multi-word name that matches start of clickup name
        if (aliasLower.includes(" ") && clickupLower.startsWith(aliasLower)) return true;
        // ClickUp full name starts with alias (only for aliases >= 4 chars to avoid false positives)
        if (aliasLower.length >= 4 && clickupLower.startsWith(aliasLower)) return true;
        return false;
      });

      if (matched) {
        member.clickupTasks = data.count;
        member.clickupByCategory = data.byCategory;
        member.clickupOnTimePct = data.pctOnTime;
        break;
      }
    }
  }

  return results.sort((a, b) => b.clickupTasks - a.clickupTasks);
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

/**
 * Extract offer/folder name from a VTurb player name.
 * Patterns:
 *   VSL-ATVFACTORY-LEAD1-...       → ATV Factory
 *   VSL-LEAD4-OGMRIDES-...         → Orgasmic Rides
 *   LEAD3-VSL-ONLYMONEY-...        → Only Money
 *   KingSolomon-LEAD5-...           → King Solomon
 *   ChiaSeed-LEAD2-...             → Chia Seed
 *   CGT-LEAD3-...                  → CGT
 *   VSl-LeCodedelaFemme-LEAD1-...  → Le Code de la Femme
 */
function extractOfferName(playerName: string): string {
  // Known offer name mappings (normalized key → display name)
  const knownOffers: Record<string, string> = {
    atvfactory: "FVA",
    vigormax: "Vigor Max",
    alphaflow: "Alpha Flow",
    ogmrides: "Orgasmic Rides",
    onlymoney: "Only Money",
    kingsolomon: "Salomao",
    chiaseed: "Chia Seed",
    sciaticshield: "Sciatic Shield",
    skyvault: "SkyVault",
    mestredacama: "Mestre da Cama",
    lecodedelafemme: "Le Code de la Femme",
    "penna-naturale": "Penna Naturale",
    pennanaturale: "Penna Naturale",
    cgt: "CGT",
    davinci: "DaVinci Frequency",
    "african water": "African Water",
    africanwater: "African Water",
    "god fingers": "God Fingers",
    godfingers: "God Fingers",
    "guardian angel": "Guardian Angel",
  };

  const name = playerName.replace(/\.mp4$/i, "").trim();

  // Remove common prefixes: "VSL-", "VSl-", "Cópia de VSL-", "Cópia de "
  const cleaned = name
    .replace(/^Cópia de\s*/i, "")
    .replace(/^VSL[\s-]*/i, "")
    .replace(/^vls?\s*/i, "");

  // Try to find offer between LEAD patterns
  // Pattern: OFFERNAME-LEAD# or LEAD#-OFFERNAME
  const parts = cleaned.split(/[-\s]+/);
  const leadIdx = parts.findIndex((p) => /^LEAD\d/i.test(p));

  let candidate = "";
  if (leadIdx > 0) {
    // Offer name is before LEAD
    candidate = parts.slice(0, leadIdx).join("").toLowerCase();
  } else if (leadIdx === 0 && parts.length > 1) {
    // LEAD is first, skip VSL if next, then take offer
    let startIdx = 1;
    if (/^vsl$/i.test(parts[1]) && parts.length > 2) startIdx = 2;
    // Take until next known delimiter (EN, FR, ITA, DE, CA, LF, $, £, €, digit pattern)
    const offerParts: string[] = [];
    for (let i = startIdx; i < parts.length; i++) {
      if (/^(EN|FR|ITA|DE|ALE|CA|LF|DG|GA|GL|IC|RO|MALU|VA|\$|£|€|\d+[;:.])/i.test(parts[i])) break;
      offerParts.push(parts[i]);
    }
    candidate = offerParts.join("").toLowerCase();
  }

  // Check known offers
  if (candidate && knownOffers[candidate]) return knownOffers[candidate];

  // Fuzzy match: check if candidate contains a known offer key
  for (const [key, display] of Object.entries(knownOffers)) {
    if (candidate.includes(key) || key.includes(candidate)) return display;
  }

  // Also check the original name for known offers
  const nameLower = name.toLowerCase();
  for (const [key, display] of Object.entries(knownOffers)) {
    if (nameLower.includes(key)) return display;
  }

  // Fallback: return candidate or "Outros"
  if (candidate && candidate.length > 1) {
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }
  return "Outros";
}

export async function getVturbStats() {
  const rows = await db
    .select({
      extraData: metricsSnapshots.extraData,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "vturb_player"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(100);

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
    offerName: string;
    started: number;
    finished: number;
    viewed: number;
    clicked: number;
    playRate: number;
    finishRate: number;
  }[] = [];

  // Deduplicate by playerId (keep most recent)
  const seen = new Set<string>();

  for (const row of rows) {
    const data = row.extraData as VturbData | null;
    if (!data?.playerId) continue;
    if (seen.has(data.playerId)) continue;
    seen.add(data.playerId);

    const started = data.started ?? 0;
    const finished = data.finished ?? 0;
    const viewed = data.viewed ?? 0;
    const clicked = data.clicked ?? 0;

    const playRate = data.playRate ?? (viewed > 0 ? (started / viewed) * 100 : 0);
    const finishRate = data.finishRate ?? (started > 0 ? (finished / started) * 100 : 0);

    playerStats.push({
      playerName: data.playerName,
      offerName: extractOfferName(data.playerName),
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
