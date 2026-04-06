"use server";

import { db } from "@/db";
import { metricsSnapshots, vsls } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { DASHBOARDS, fetchDashboardSummary, fetchMetaAdObjects } from "@/lib/utmify";
import { fetchVideoAnalytics, extractVideoId } from "@/lib/vturb";

export async function triggerSync(endpoint: string) {
  try {
    if (endpoint.includes("sync-utmify")) {
      return await syncUtmify();
    } else if (endpoint.includes("sync-clickup")) {
      return await syncClickup();
    } else if (endpoint.includes("sync-vturb")) {
      return await syncVturb();
    }
    return "Endpoint desconhecido";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return `Erro: ${msg}`;
  }
}

async function syncUtmify() {
  if (!process.env.UTMIFY_API_KEY) return "Erro: UTMIFY_API_KEY não configurada";

  let synced = 0;
  for (const dashboard of DASHBOARDS) {
    try {
      const summary = await fetchDashboardSummary(dashboard.id, dashboard.timeZone);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await db.insert(metricsSnapshots).values({
        date: yesterday,
        entityType: "dashboard",
        entityId: 0,
        source: "utmify",
        spend: summary.adSpend ? String(summary.adSpend / 100) : null,
        revenue: summary.revenue ? String(summary.revenue / 100) : null,
        cpa: summary.cpa ? String(summary.cpa / 100) : null,
        roas: summary.roas ? String(summary.roas) : null,
        extraData: {
          dashboardId: dashboard.id,
          dashboardName: dashboard.name,
          currency: dashboard.currency,
          ordersTotal: summary.ordersCount?.total ?? 0,
          ordersApproved: summary.ordersCount?.approved ?? 0,
        },
      });

      try {
        const metaData = await fetchMetaAdObjects(dashboard.id, dashboard.timeZone);
        for (const campaign of metaData.results) {
          await db.insert(metricsSnapshots).values({
            date: yesterday,
            entityType: "meta_campaign",
            entityId: 0,
            source: "utmify",
            impressions: campaign.impressions ?? null,
            clicks: campaign.clicks ?? null,
            spend: campaign.spend ? String(campaign.spend / 100) : null,
            revenue: campaign.revenue ? String(campaign.revenue / 100) : null,
            cpa: campaign.cpa ? String(campaign.cpa / 100) : null,
            roas: campaign.roas ? String(campaign.roas) : null,
            extraData: { campaignName: campaign.name, campaignId: campaign.id, dashboardId: dashboard.id },
          });
        }
      } catch { /* meta campaign sync optional */ }

      synced++;
    } catch (err) {
      console.error(`[UTMify Sync] ${dashboard.name}:`, err);
    }
  }

  return `Sincronizado com sucesso! ${synced} dashboard(s) processado(s)`;
}

async function syncClickup() {
  if (!process.env.CLICKUP_API_KEY) return "Erro: CLICKUP_API_KEY não configurada";

  const SPACE_ID = "90131585986";
  const API = "https://api.clickup.com/api/v2";
  const headers = { Authorization: process.env.CLICKUP_API_KEY };
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // 1. Discover ALL folders in the space
  const foldersRes = await fetch(`${API}/space/${SPACE_ID}/folder?archived=false`, { headers });
  const foldersData = foldersRes.ok ? await foldersRes.json() : { folders: [] };

  // 2. Collect ALL list IDs from all folders + folderless lists
  const allListIds: string[] = [];

  for (const folder of foldersData.folders ?? []) {
    for (const list of folder.lists ?? []) {
      allListIds.push(list.id);
    }
  }

  // Also get folderless lists
  const folderlessRes = await fetch(`${API}/space/${SPACE_ID}/list?archived=false`, { headers });
  const folderlessData = folderlessRes.ok ? await folderlessRes.json() : { lists: [] };
  for (const list of folderlessData.lists ?? []) {
    allListIds.push(list.id);
  }

  // 3. Fetch completed tasks from ALL lists
  let totalTasks = 0;
  const globalByAssignee = new Map<string, { name: string; count: number }>();

  for (const listId of allListIds) {
    try {
      const res = await fetch(
        `${API}/list/${listId}/task?statuses[]=complete&statuses[]=closed&date_updated_gt=${sevenDaysAgo}&include_closed=true`,
        { headers }
      );

      if (!res.ok) continue;
      const data = await res.json();
      const tasks = data.tasks ?? [];
      totalTasks += tasks.length;

      for (const task of tasks) {
        for (const assignee of task.assignees ?? []) {
          const id = assignee.id.toString();
          const existing = globalByAssignee.get(id) ?? { name: assignee.username || assignee.email || `User ${id}`, count: 0 };
          existing.count++;
          globalByAssignee.set(id, existing);
        }
      }
    } catch { /* skip individual list errors */ }
  }

  // 4. Save aggregated data per member
  for (const [memberId, info] of globalByAssignee) {
    await db.insert(metricsSnapshots).values({
      date: new Date(),
      entityType: "clickup_member",
      entityId: parseInt(memberId) || 0,
      source: "manual",
      extraData: { memberName: info.name, taskCount: info.count, totalLists: allListIds.length },
    });
  }

  return `Sincronizado com sucesso! ${totalTasks} tarefa(s) de ${globalByAssignee.size} membro(s) em ${allListIds.length} lista(s)`;
}

async function syncVturb() {
  if (!process.env.VTURB_API_KEY) return "Erro: VTURB_API_KEY não configurada";

  const vslsWithLinks = await db
    .select({ id: vsls.id, btubeLink: vsls.btubeLink })
    .from(vsls)
    .where(isNotNull(vsls.btubeLink));

  let synced = 0;
  for (const vsl of vslsWithLinks) {
    if (!vsl.btubeLink) continue;
    const videoId = extractVideoId(vsl.btubeLink);
    if (!videoId) continue;

    try {
      const analytics = await fetchVideoAnalytics(videoId);
      if (!analytics) continue;

      await db.insert(metricsSnapshots).values({
        date: new Date(),
        entityType: "vsl",
        entityId: vsl.id,
        source: "utmify",
        pageVisits: analytics.views ?? null,
        playRate: analytics.playRate ? String(analytics.playRate) : null,
        videoRetentionJson: analytics.retention ?? null,
        extraData: { source: "vturb", videoId, title: analytics.title },
      });
      synced++;
    } catch { /* skip individual errors */ }
  }

  return `Sincronizado com sucesso! ${synced} VSL(s) processada(s)`;
}
