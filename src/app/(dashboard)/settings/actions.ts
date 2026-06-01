"use server";

import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { DASHBOARDS, fetchDashboardSummary, fetchMetaAdObjects } from "@/lib/utmify";
import { requireAdmin } from "@/lib/admin-auth";

export async function triggerSync(endpoint: string) {
  await requireAdmin();
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
  // Get first day of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

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
        `${API}/list/${listId}/task?statuses[]=complete&statuses[]=closed&date_updated_gt=${monthStart}&include_closed=true`,
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

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const dateFrom = weekAgo.toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];

  // Fetch all players from VTurb
  const { fetchPlayers, fetchEventsByPlayer } = await import("@/lib/vturb");
  const playersData = await fetchPlayers();

  if (!playersData?.players?.length) {
    return "VTurb: nenhum player encontrado";
  }

  const playerIds = playersData.players.map((p: { id: string }) => p.id);
  let synced = 0;

  try {
    // Bulk fetch events (returns Map<playerId, {started,finished,viewed,clicked}>)
    const eventsMap = await fetchEventsByPlayer(playerIds, dateFrom, dateTo);

    // Only save players with activity + 20 inactive
    const withActivity = playersData.players.filter((p: { id: string }) => {
      const ev = eventsMap?.get(p.id);
      return ev && (ev.started > 0 || ev.viewed > 0);
    });
    const inactive = playersData.players
      .filter((p: { id: string }) => !withActivity.find((w: { id: string }) => w.id === p.id))
      .slice(0, 20);

    for (const player of [...withActivity, ...inactive]) {
      const events = eventsMap?.get(player.id) ?? { started: 0, finished: 0, viewed: 0, clicked: 0 };

      const playRate = events.viewed > 0
        ? Math.round((events.started / events.viewed) * 10000) / 100
        : 0;
      const finishRate = events.started > 0
        ? Math.round((events.finished / events.started) * 10000) / 100
        : 0;

      await db.insert(metricsSnapshots).values({
        date: now,
        entityType: "vturb_player",
        entityId: 0,
        source: "manual",
        extraData: {
          source: "vturb",
          playerId: player.id,
          playerName: player.name,
          duration: player.duration,
          pitchTime: player.pitch_time,
          started: events.started,
          finished: events.finished,
          viewed: events.viewed,
          clicked: events.clicked,
          playRate,
          finishRate,
        },
      });
      synced++;
    }
  } catch (e) {
    console.error("[VTurb sync]", e);
    return `Erro VTurb: ${e instanceof Error ? e.message : "Erro desconhecido"}`;
  }

  return `Sincronizado com sucesso! ${synced} player(s) do VTurb processado(s)`;
}
