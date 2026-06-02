"use server";

import { db } from "@/db";
import { projects, vsls, creatives, campaigns, teamMembers, metricsSnapshots, offerTracking } from "@/db/schema";
import { fieldContainsMember, fieldMatchesMember, getMemberAliases } from "@/lib/team-utils";
import { extractOfferFromCampaignName } from "@/lib/utmify";
import { eq, sql, desc, and, inArray, gte, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";

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
  pctNaoEscalou: number;
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  roas: number | null;
  currency: string;
  hasCampaignData: boolean;
};

// ========== FILTER OPTIONS ==========

// Resultado cacheado por 300s com tag 'analytics-filters'.
// Invalide com revalidateTag('analytics-filters', 'max') ao mutar offerTracking ou teamMembers.
export const getFilterOptions = unstable_cache(
  async function _getFilterOptions() {
    const [nicheRows, languageRows, copywriters, editors, formatRows] = await Promise.all([
      db
        .selectDistinct({ niche: offerTracking.name })
        .from(offerTracking)
        .where(sql`${offerTracking.name} IS NOT NULL`)
        .orderBy(offerTracking.name),
      db
        .selectDistinct({ language: offerTracking.language })
        .from(offerTracking)
        .orderBy(offerTracking.language),
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
  },
  ["analytics-filter-options"],
  { tags: ["analytics-filters"], revalidate: 300 },
);

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
    conditions.push(inArray(projects.status, filters.statuses as ("escalou" | "nao_escalou" | "em_teste" | "rodando" | "pausado")[]));
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
    conditions.push(inArray(creatives.format, filters.formats as ("especialista" | "ugc_masc" | "ugc_fem" | "famoso" | "youtuber" | "autoridade" | "podcast")[]));
  }

  if (filters?.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(creatives.status, filters.statuses as ("rascunho" | "validou" | "nao_validou" | "escalou" | "nao_escalou")[]));
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

// Date filters are accepted for API compat but ignored until historical granularity is available.
export async function getCreativesByFormat(
  filters?: { language?: string; format?: string; validation?: string },
  _dateFrom?: string,
  _dateTo?: string,
) {
  const conditions = [];

  if (filters?.language) {
    conditions.push(eq(offerTracking.language, filters.language));
  }
  if (filters?.format) {
    conditions.push(sql`${offerTracking.adFormat}::text = ${filters.format}`);
  }
  if (filters?.validation) {
    conditions.push(eq(offerTracking.validation, filters.validation));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Group by offer name to show which offers/ads exist
  return db
    .select({
      format: offerTracking.name,
      platform: sql<string | null>`coalesce(${offerTracking.adFormat}::text, null)`,
      count: sql<number>`1`,
      countEscalou: sql<number>`case when ${offerTracking.validation} = 'SIM' and (${offerTracking.scale} = 'SIM' or ${offerTracking.scale} = 'EM ANDAMENTO') then 1 else 0 end`,
      countValidou: sql<number>`case when ${offerTracking.validation} = 'SIM' and (${offerTracking.scale} = 'SIM' or ${offerTracking.scale} = 'EM ANDAMENTO') then 1 else 0 end`,
      countNaoValidou: sql<number>`case when ${offerTracking.scale} in ('NAO', 'NÃO') or ${offerTracking.validation} in ('NÃO DEU CERTO') then 1 else 0 end`,
      pctEscalou: sql<number>`0`,
      pctEscalouX: sql<number>`0`,
      pctNaoEscalou: sql<number>`0`,
      // Extra fields for the offer view
      language: offerTracking.language,
      adsEdited: offerTracking.adsEditedCount,
      validation: offerTracking.validation,
      scale: offerTracking.scale,
      copyVsl: offerTracking.copyVsl,
    })
    .from(offerTracking)
    .where(whereClause)
    .orderBy(desc(offerTracking.adsEditedCount));
}

// ========== TEAM PERFORMANCE ==========

// Filters by ClickUp task DUE DATE — falls back to done date when a task has no deadline.
// Data is sourced from per-task snapshots populated by /api/cron/sync-clickup.
export async function getTeamPerformance(dateFrom?: string, dateTo?: string) {
  // Fetch team members and all offer tracking data in parallel
  const [members, allOffers] = await Promise.all([
    db.select().from(teamMembers).where(eq(teamMembers.active, true)),
    db.select().from(offerTracking).limit(500),
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
        // Sum from adsEditedByPerson JSONB if available
        const editPersonData = offer.adsEditedByPerson as Record<string, number> | null;
        let editedHere = 0;
        if (editPersonData) {
          for (const [k, v] of Object.entries(editPersonData)) {
            if (aliases.some((a) => a === k.toUpperCase())) {
              editedHere += Number(v) || 0;
              break;
            }
          }
        }
        if (editedHere > 0) {
          creativesEditCount += editedHere;
          if (isEscalou) creativesEscalouCount++;
        } else if (isEditorAds || isEditorVsl) {
          // Fallback to legacy boolean match when per-person data not filled
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

  // Fetch ClickUp tasks from per-task snapshots, filtered by due date.
  // Each row is one (task × assignee) pair, with `date` set to the task's due_date
  // (falling back to done date when there's no deadline).
  const taskConditions = [eq(metricsSnapshots.entityType, "clickup_task")];
  if (dateFrom) taskConditions.push(gte(metricsSnapshots.date, new Date(dateFrom)));
  if (dateTo) taskConditions.push(lte(metricsSnapshots.date, new Date(dateTo)));

  const taskRows = await db
    .select({
      entityId: metricsSnapshots.entityId,
      extraData: metricsSnapshots.extraData,
    })
    .from(metricsSnapshots)
    .where(and(...taskConditions));

  type TaskData = {
    memberId?: string;
    memberName?: string;
    category?: string;
    onTime?: boolean | null;
  };

  const clickupByName = new Map<string, { count: number; byCategory: Record<string, number>; withDueDate: number; onTime: number }>();
  for (const row of taskRows) {
    const data = row.extraData as TaskData | null;
    if (!data?.memberName) continue;
    const key = data.memberName.toLowerCase();
    let agg = clickupByName.get(key);
    if (!agg) {
      agg = { count: 0, byCategory: {}, withDueDate: 0, onTime: 0 };
      clickupByName.set(key, agg);
    }
    agg.count += 1;
    if (data.category) {
      agg.byCategory[data.category] = (agg.byCategory[data.category] || 0) + 1;
    }
    if (data.onTime != null) {
      agg.withDueDate += 1;
      if (data.onTime) agg.onTime += 1;
    }
  }

  // Compute pctOnTime per member from the filtered task slice
  const clickupSummary = new Map<string, { count: number; byCategory: Record<string, number>; pctOnTime: number | null }>();
  for (const [name, agg] of clickupByName) {
    clickupSummary.set(name, {
      count: agg.count,
      byCategory: agg.byCategory,
      pctOnTime: agg.withDueDate > 0
        ? Math.round((agg.onTime / agg.withDueDate) * 10000) / 100
        : null,
    });
  }

  // Match ClickUp members against team members. Strategy:
  //  1. Aliases that have ≥ 2 words (full names) must have ALL words present in the
  //     ClickUp name. This avoids "Gabriel" alias on Fischer accidentally matching
  //     "Gabriel Lima".
  //  2. Single-word aliases must equal the ClickUp first name exactly OR match via
  //     a longer prefix on the full ClickUp name.
  //  3. We score each candidate and pick the best (more matched words = better)
  //     so that "Gabriel Fischer" beats a stray "Gabriel" alias in case both fire.
  for (const member of results) {
    const aliases = getMemberAliases(member.name).map((a) => a.toLowerCase());
    let bestMatch: { name: string; score: number; data: typeof clickupSummary extends Map<string, infer V> ? V : never } | null = null;

    for (const [clickupName, data] of clickupSummary) {
      const clickupLower = clickupName.toLowerCase();
      const clickupWords = new Set(clickupLower.split(/\s+/));

      let bestScoreForThisName = 0;
      for (const alias of aliases) {
        const aliasParts = alias.split(/\s+/).filter(Boolean);
        let score = 0;

        if (aliasParts.length >= 2) {
          // Multi-word alias: every word must be in the clickup name
          if (aliasParts.every((p) => clickupWords.has(p))) {
            score = aliasParts.length + 1; // longer matches win
          }
        } else if (aliasParts.length === 1) {
          const a = aliasParts[0];
          // Exact full match
          if (clickupLower === a) score = 10;
          // ClickUp first name equals alias exactly
          else if (clickupLower.split(/\s+/)[0] === a) score = 1;
          // Sigla / nickname (short alias matches a word inside the clickup name)
          else if (a.length >= 4 && clickupWords.has(a)) score = 2;
        }

        if (score > bestScoreForThisName) bestScoreForThisName = score;
      }

      if (bestScoreForThisName > 0 && (!bestMatch || bestScoreForThisName > bestMatch.score)) {
        bestMatch = { name: clickupName, score: bestScoreForThisName, data };
      }
    }

    if (bestMatch) {
      member.clickupTasks = bestMatch.data.count;
      member.clickupByCategory = bestMatch.data.byCategory;
      member.clickupOnTimePct = bestMatch.data.pctOnTime;
    }
  }

  return results.sort((a, b) => b.clickupTasks - a.clickupTasks);
}

// ========== OFFERS RANKING ==========

// Date filters accepted for API compat but ignored.
export async function getOffersRanking(
  filters?: AnalyticsFilters,
  _dateFrom?: string,
  _dateTo?: string,
) {
  const conditions = buildProjectConditions(filters);
  const whereClause = combineConditions(conditions);

  // Use LEFT JOIN + GROUP BY em vez de ~7-8 subqueries correlacionadas por linha.
  // COUNT(DISTINCT) em cada tabela evita duplicacao de linhas quando multiplos joins
  // retornam N:M (ex: um projeto com 3 vsls e 2 creatives geraria 6 linhas sem DISTINCT).
  // creatives/vsls/campaigns estao vazias hoje — resultado identico, sem subquery por linha.
  return db
    .select({
      id: projects.id,
      name: projects.name,
      niche: projects.niche,
      language: projects.language,
      status: projects.status,
      vslCount: sql<number>`count(distinct ${vsls.id})`,
      creativeCount: sql<number>`count(distinct ${creatives.id})`,
      campaignCount: sql<number>`count(distinct ${campaigns.id})`,
      creativesEscalou: sql<number>`count(distinct case when ${creatives.status} = 'escalou' then ${creatives.id} end)`,
      creativesValidou: sql<number>`count(distinct case when ${creatives.status} = 'validou' then ${creatives.id} end)`,
      creativesNaoValidou: sql<number>`count(distinct case when ${creatives.status} = 'nao_validou' then ${creatives.id} end)`,
      pctEscalou: sql<number>`round(100.0 * count(distinct case when ${creatives.status} = 'escalou' then ${creatives.id} end) / nullif(count(distinct ${creatives.id}), 0), 2)`,
      pctEscalouX: sql<number>`round(100.0 * count(distinct case when ${creatives.status} = 'validou' then ${creatives.id} end) / nullif(count(distinct ${creatives.id}), 0), 2)`,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(vsls, eq(vsls.projectId, projects.id))
    .leftJoin(creatives, eq(creatives.projectId, projects.id))
    .leftJoin(campaigns, eq(campaigns.projectId, projects.id))
    .where(whereClause)
    .groupBy(projects.id, projects.name, projects.niche, projects.language, projects.status, projects.createdAt)
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

export async function getVturbStats(dateFrom?: string, dateTo?: string) {
  try {
  const { fetchPlayers, fetchEventsByPlayer } = await import("@/lib/vturb");

  // Default: last 7 days
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const from = dateFrom || defaultFrom.toISOString().split("T")[0];
  const to = dateTo || now.toISOString().split("T")[0];

  // 1. Get all players (includes pitch_time and duration)
  const playersData = await fetchPlayers();
  if (!playersData?.players?.length) return [];

  const playerIds = playersData.players.map((p) => p.id);

  // 2. Get events per player for the date range
  const eventsMap = await fetchEventsByPlayer(playerIds, from, to);

  // 3. Build stats per player
  const playerStats: {
    playerName: string;
    offerName: string;
    started: number;
    finished: number;
    viewed: number;
    clicked: number;
    playRate: number;
    pitchRetention: number;
    duration: number;
    pitchTime: number;
  }[] = [];

  for (const player of playersData.players) {
    const events = eventsMap?.get(player.id);
    if (!events || (events.started === 0 && events.viewed === 0)) continue;

    const playRate = events.viewed > 0
      ? Math.round((events.started / events.viewed) * 10000) / 100
      : 0;

    // Pitch retention: approximate from finished/started if over_pitch not available
    // finished = people who watched past the pitch point in most cases
    const pitchRetention = events.started > 0
      ? Math.round((events.finished / events.started) * 10000) / 100
      : 0;

    playerStats.push({
      playerName: player.name,
      offerName: extractOfferName(player.name),
      started: events.started,
      finished: events.finished,
      viewed: events.viewed,
      clicked: events.clicked,
      playRate,
      pitchRetention,
      duration: player.duration ?? 0,
      pitchTime: player.pitch_time ?? 0,
    });
  }

  return playerStats
    .sort((a, b) => b.started - a.started)
    .slice(0, 100);
  } catch (err) {
    console.error("[getVturbStats] Error:", err);
    return [];
  }
}

// ========== UTMIFY OFFER METRICS (from DB cache) ==========

export async function getUtmifyOfferMetrics() {
  const rows = await db
    .select({ extraData: metricsSnapshots.extraData })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "utmify_offer"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(50);

  type UtmOfferData = {
    offerName: string;
    spend: number;
    revenue: number;
    profit: number;
    orders: number;
    clicks: number;
    checkouts: number;
    costPerCheckout: number | null;
    cpa: number | null;
    roas: number | null;
    currency: string;
  };

  const seen = new Set<string>();
  const results: UtmOfferData[] = [];

  for (const row of rows) {
    const data = row.extraData as UtmOfferData | null;
    if (!data?.offerName || seen.has(data.offerName)) continue;
    seen.add(data.offerName);
    results.push(data);
  }

  return results;
}

// ========== COMPARISON DATA ==========

// Date filters affect UTMify financial data (via utmify_campaign_daily snapshots).
// Offer status filters (escalou/validacao) remain snapshot-independent.
export async function getComparisonData(
  dimension: "niche" | "language" | "copywriter" | "editor",
  values: [string, string],
  dateFrom?: string,
  dateTo?: string,
) {
  const results: ComparisonData[] = [];

  // Pre-fetch utmify campaign snapshots once.
  // Daily mode when date range is set (SUM per campaignId), else total mode (max-spend dedup).
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const entityType = hasDateFilter ? "utmify_campaign_daily" : "utmify_campaign_by_offer";
  const campaignConditions = [eq(metricsSnapshots.entityType, entityType)];
  if (dateFrom) campaignConditions.push(gte(metricsSnapshots.date, new Date(dateFrom)));
  if (dateTo) campaignConditions.push(lte(metricsSnapshots.date, new Date(dateTo)));

  const campaignRows = await db
    .select({
      extraData: metricsSnapshots.extraData,
      spend: metricsSnapshots.spend,
      revenue: metricsSnapshots.revenue,
    })
    .from(metricsSnapshots)
    .where(and(...campaignConditions))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(5000);

  type CampaignRow = { offerName: string; campaignId: string; currency: string };
  const campaignByOffer = new Map<string, { spend: number; revenue: number; currency: string }[]>();
  const seenCampaignId = new Map<string, { spend: number; revenue: number; offerName: string; currency: string }>();

  for (const row of campaignRows) {
    const d = row.extraData as CampaignRow | null;
    if (!d?.offerName || !d.campaignId) continue;
    const spend = Number(row.spend ?? 0);
    const revenue = Number(row.revenue ?? 0);
    const existing = seenCampaignId.get(d.campaignId);
    if (hasDateFilter) {
      // Daily mode: SUM snapshots per campaignId
      if (!existing) {
        seenCampaignId.set(d.campaignId, { spend, revenue, offerName: d.offerName, currency: d.currency ?? "USD" });
      } else {
        existing.spend += spend;
        existing.revenue += revenue;
      }
    } else {
      // Total mode: max-spend dedup
      if (!existing || spend > existing.spend) {
        seenCampaignId.set(d.campaignId, { spend, revenue, offerName: d.offerName, currency: d.currency ?? "USD" });
      }
    }
  }
  for (const c of seenCampaignId.values()) {
    if (!campaignByOffer.has(c.offerName)) campaignByOffer.set(c.offerName, []);
    campaignByOffer.get(c.offerName)!.push({ spend: c.spend, revenue: c.revenue, currency: c.currency });
  }

  // Resolve label e whereClause para cada valor — member lookups sao independentes entre si
  // e entre os dois valores, entao paralelizamos tudo com Promise.all.
  async function resolveValueContext(value: string): Promise<{ label: string; whereClause: ReturnType<typeof and> | undefined }> {
    let label = value;
    const conditions: ReturnType<typeof eq>[] = [];

    switch (dimension) {
      case "language":
        conditions.push(eq(offerTracking.language, value));
        break;
      case "copywriter": {
        const memberId = parseInt(value, 10);
        const [member] = await db
          .select({ name: teamMembers.name })
          .from(teamMembers)
          .where(eq(teamMembers.id, memberId));
        if (member) {
          label = member.name;
          conditions.push(sql`(${offerTracking.copyVsl} ILIKE ${`%${member.name.split(" ")[0]}%`})` as unknown as ReturnType<typeof eq>);
        }
        break;
      }
      case "editor": {
        const memberId = parseInt(value, 10);
        const [member] = await db
          .select({ name: teamMembers.name })
          .from(teamMembers)
          .where(eq(teamMembers.id, memberId));
        if (member) {
          label = member.name;
          conditions.push(sql`(${offerTracking.editorAds} ILIKE ${`%${member.name.split(" ")[0]}%`} OR ${offerTracking.editorVsl} ILIKE ${`%${member.name.split(" ")[0]}%`})` as unknown as ReturnType<typeof eq>);
        }
        break;
      }
      case "niche":
        conditions.push(eq(offerTracking.name, value));
        break;
    }

    return { label, whereClause: conditions.length > 0 ? and(...conditions) : undefined };
  }

  // Paralelizar resolucao de contexto dos 2 valores
  const [ctxA, ctxB] = await Promise.all([
    resolveValueContext(values[0]),
    resolveValueContext(values[1]),
  ]);

  // Para cada valor, paralelizar as 3 queries independentes entre si
  async function fetchValueData(ctx: { label: string; whereClause: ReturnType<typeof and> | undefined }) {
    const { label, whereClause } = ctx;

    const [statsRows, vslRows, offerNameRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          escalou: sql<number>`count(*) filter (where ${offerTracking.validation} = 'SIM' and (${offerTracking.scale} = 'SIM' or ${offerTracking.scale} = 'EM ANDAMENTO'))`,
          validou: sql<number>`count(*) filter (where ${offerTracking.validation} = 'SIM')`,
          naoValidou: sql<number>`count(*) filter (where ${offerTracking.validation} in ('NAO', 'NÃO DEU CERTO'))`,
          totalAds: sql<number>`coalesce(sum(${offerTracking.adsEditedCount}), 0)`,
        })
        .from(offerTracking)
        .where(whereClause),
      db
        .select({ total: sql<number>`count(*)` })
        .from(offerTracking)
        .where(whereClause ? and(whereClause, eq(offerTracking.copyVslStatus, "SIM")) : eq(offerTracking.copyVslStatus, "SIM")),
      db
        .selectDistinct({ name: offerTracking.name })
        .from(offerTracking)
        .where(whereClause),
    ]);

    const stats = statsRows[0];
    const vslCount = vslRows[0];

    // Puxar nomes de ofertas distintos pra agregar UTMify
    let totalSpend = 0;
    let totalRevenue = 0;
    const currencyTally = new Map<string, number>();
    let hasCampaignData = false;
    for (const { name } of offerNameRows) {
      const camps = campaignByOffer.get(name);
      if (!camps) continue;
      hasCampaignData = true;
      for (const c of camps) {
        totalSpend += c.spend;
        totalRevenue += c.revenue;
        currencyTally.set(c.currency, (currencyTally.get(c.currency) ?? 0) + 1);
      }
    }
    const currency = Array.from(currencyTally.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
    const totalProfit = totalRevenue - totalSpend;
    const roas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : null;

    const total = Number(stats.total);

    return {
      label,
      totalCreatives: total,
      totalVsls: Number(vslCount.total),
      pctEscalou: total > 0 ? Math.round((Number(stats.escalou) / total) * 10000) / 100 : 0,
      pctNaoEscalou: total > 0 ? Math.round((Number(stats.naoValidou) / total) * 10000) / 100 : 0,
      totalSpend,
      totalRevenue,
      totalProfit,
      roas,
      currency,
      hasCampaignData,
    } satisfies ComparisonData;
  }

  // Paralelizar fetch dos 2 valores simultaneamente
  const [dataA, dataB] = await Promise.all([
    fetchValueData(ctxA),
    fetchValueData(ctxB),
  ]);

  results.push(dataA, dataB);

  return results;
}

// ========== UTMIFY CAMPAIGN DATA ==========

export type CampaignInput = {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  dashboardId: string;
  currency: string;
};

/**
 * Save UTMify campaign data fetched via MCP to DB cache.
 * Automatically extracts offer name from campaign name.
 */
export async function saveUtmifyCampaignData(campaignList: CampaignInput[]) {
  const now = new Date();

  // Clear old campaign data before inserting fresh
  await db
    .delete(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "utmify_campaign_by_offer"));

  // Batch insert: um unico round-trip ao banco em vez de N inserts sequenciais
  if (campaignList.length > 0) {
    const rows = campaignList.map((campaign) => {
      const offerName = extractOfferFromCampaignName(campaign.name);
      return {
        date: now,
        entityType: "utmify_campaign_by_offer" as const,
        entityId: 0,
        source: "utmify" as const,
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
          dashboardId: campaign.dashboardId,
          currency: campaign.currency,
        },
      };
    });

    await db.insert(metricsSnapshots).values(rows);
  }

  return { saved: campaignList.length };
}

export type OfferCampaignSummary = {
  offerName: string;
  activeCampaigns: number;
  totalSpend: number;
  totalRevenue: number;
  roas: number | null;
  currency: string;
};

/**
 * Read campaign data from DB cache, grouped by offer.
 */
// Two modes:
// - No date range: reads `utmify_campaign_by_offer` (total snapshot from last manual resync).
// - With date range: reads `utmify_campaign_daily` and SUMS all daily snapshots per campaignId
//   within the range (each daily snapshot = 1 campaign's spend/revenue for 1 day).
export async function getOfferCampaignSummary(
  dateFrom?: string,
  dateTo?: string,
): Promise<{ offers: OfferCampaignSummary[]; lastSync: Date | null }> {
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const entityType = hasDateFilter ? "utmify_campaign_daily" : "utmify_campaign_by_offer";

  const conditions = [eq(metricsSnapshots.entityType, entityType)];
  if (dateFrom) conditions.push(gte(metricsSnapshots.date, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(metricsSnapshots.date, new Date(dateTo)));

  const rows = await db
    .select({
      extraData: metricsSnapshots.extraData,
      spend: metricsSnapshots.spend,
      revenue: metricsSnapshots.revenue,
      createdAt: metricsSnapshots.createdAt,
    })
    .from(metricsSnapshots)
    .where(and(...conditions))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(5000);

  type CampaignRow = {
    offerName: string;
    campaignName: string;
    campaignId: string;
    currency: string;
  };

  const campaignData = new Map<
    string,
    { spend: number; revenue: number; offerName: string; currency: string }
  >();

  let lastSync: Date | null = null;

  for (const row of rows) {
    if (!lastSync && row.createdAt) lastSync = new Date(row.createdAt);

    const data = row.extraData as CampaignRow | null;
    if (!data?.offerName || !data.campaignId) continue;

    const spend = Number(row.spend ?? 0);
    const revenue = Number(row.revenue ?? 0);
    const existing = campaignData.get(data.campaignId);

    if (hasDateFilter) {
      // Daily mode: SUM all daily snapshots within the range per campaignId
      if (!existing) {
        campaignData.set(data.campaignId, { spend, revenue, offerName: data.offerName, currency: data.currency ?? "USD" });
      } else {
        existing.spend += spend;
        existing.revenue += revenue;
      }
    } else {
      // Legacy total mode: max-spend dedup (protects against duplicate total snapshots)
      if (!existing || spend > existing.spend) {
        campaignData.set(data.campaignId, { spend, revenue, offerName: data.offerName, currency: data.currency ?? "USD" });
      }
    }
  }

  const offerMap = new Map<
    string,
    { totalSpend: number; totalRevenue: number; currency: string; count: number }
  >();

  for (const entry of campaignData.values()) {
    let offer = offerMap.get(entry.offerName);
    if (!offer) {
      offer = { totalSpend: 0, totalRevenue: 0, currency: entry.currency, count: 0 };
      offerMap.set(entry.offerName, offer);
    }
    offer.totalSpend += entry.spend;
    offer.totalRevenue += entry.revenue;
    offer.count++;
  }

  const offers: OfferCampaignSummary[] = [];
  for (const [offerName, entry] of offerMap) {
    offers.push({
      offerName,
      activeCampaigns: entry.count,
      totalSpend: entry.totalSpend,
      totalRevenue: entry.totalRevenue,
      roas: entry.totalSpend > 0 ? Math.round((entry.totalRevenue / entry.totalSpend) * 100) / 100 : null,
      currency: entry.currency,
    });
  }

  return { offers: offers.sort((a, b) => b.totalSpend - a.totalSpend), lastSync };
}

// ========== UTMIFY AD-LEVEL DATA ==========

export type OfferAd = {
  adNumber: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number | null;
  variantName: string;
  editors: string;
  variantCount: number;
  adFormat: string | null;
};

/**
 * Read all individual ads from DB cache, grouped by offer name.
 */
// Note: UTMify ad data is a snapshot of total accumulated at sync time.
// Date filters are accepted but ignored — see getOfferCampaignSummary.
export async function getOfferAdsSummary(
  _dateFrom?: string,
  _dateTo?: string,
): Promise<Map<string, OfferAd[]>> {
  const rows = await db
    .select({
      extraData: metricsSnapshots.extraData,
      spend: metricsSnapshots.spend,
      revenue: metricsSnapshots.revenue,
    })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityType, "utmify_ad_by_offer"))
    .limit(2000);

  const map = new Map<string, OfferAd[]>();

  for (const row of rows) {
    const data = row.extraData as {
      offerName: string;
      adNumber: string;
      variantName: string;
      editors: string;
      variantCount: number;
      profit: number;
      adFormat?: string | null;
    } | null;
    if (!data?.offerName) continue;

    const spend = Number(row.spend ?? 0);
    const revenue = Number(row.revenue ?? 0);

    const ad: OfferAd = {
      adNumber: data.adNumber ?? "-",
      spend,
      revenue,
      profit: data.profit ?? revenue - spend,
      roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
      variantName: data.variantName ?? "-",
      editors: data.editors ?? "-",
      variantCount: data.variantCount ?? 0,
      adFormat: data.adFormat ?? null,
    };

    if (!map.has(data.offerName)) map.set(data.offerName, []);
    map.get(data.offerName)!.push(ad);
  }

  // Sort ads by spend descending within each offer
  for (const [, ads] of map) {
    ads.sort((a, b) => b.spend - a.spend);
  }

  return map;
}
