import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

// All lists in the NGV Digital workspace
const LISTS = [
  // Copy
  { id: "901321719582", name: "Copy > Produto" },
  { id: "901304977280", name: "Copy > Copy" },
  { id: "901326732014", name: "Copy > Outros" },
  // Edição de Video
  { id: "901305226239", name: "Edição > Criativos" },
  { id: "901305822758", name: "Edição > VSL" },
  { id: "901323967307", name: "Edição > Produtos" },
  { id: "901326732017", name: "Edição > Outros" },
  // Recuperação de Vendas
  { id: "901305422324", name: "Recuperação > Tarefas" },
  // Dev
  { id: "901323138754", name: "Dev > Outros" },
  { id: "901325026428", name: "Dev > Sites" },
  // Tráfego Pago
  { id: "901323524276", name: "Tráfego > Tarefas" },
  // Diogo
  { id: "901306192613", name: "Diogo > List" },
];

type ClickUpTask = {
  id: string;
  name: string;
  status: { status: string };
  date_updated: string;
  due_date: string | null;
  date_done: string | null;
  date_closed: string | null;
  assignees: { id: number; username: string; email: string }[];
};

type ClickUpResponse = {
  tasks: ClickUpTask[];
  last_page: boolean;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CLICKUP_API_KEY not configured" }, { status: 500 });
  }

  // Last 30 days for broader coverage
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const results: { list: string; status: string; tasksFound: number; error?: string }[] = [];
  const memberTaskCounts: Record<string, {
    name: string;
    count: number;
    withDueDate: number;
    onTime: number;
    late: number;
    lists: string[];
  }> = {};

  for (const list of LISTS) {
    let totalTasks = 0;
    try {
      // Paginate through all completed tasks in the last 30 days
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const url = `${CLICKUP_API_BASE}/list/${list.id}/task?include_closed=true&statuses[]=complete&page=${page}&subtasks=true&order_by=date_done&reverse=true`;
        const res = await fetch(url, {
          headers: { Authorization: apiKey },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`ClickUp API failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as ClickUpResponse;
        const tasks = data.tasks || [];

        // Filter to tasks completed in the last 30 days
        for (const task of tasks) {
          const doneMs = task.date_done ? parseInt(task.date_done, 10)
            : task.date_closed ? parseInt(task.date_closed, 10)
            : 0;

          // Skip tasks completed before our window
          if (doneMs > 0 && doneMs < thirtyDaysAgo) continue;
          // Skip tasks not completed yet (shouldn't happen with status filter, but safety)
          if (doneMs === 0) continue;

          totalTasks++;

          for (const assignee of task.assignees) {
            const key = String(assignee.id);
            if (!memberTaskCounts[key]) {
              memberTaskCounts[key] = {
                name: assignee.username,
                count: 0,
                withDueDate: 0,
                onTime: 0,
                late: 0,
                lists: [],
              };
            }
            memberTaskCounts[key].count += 1;
            if (!memberTaskCounts[key].lists.includes(list.name)) {
              memberTaskCounts[key].lists.push(list.name);
            }

            // Calculate on-time completion
            if (task.due_date) {
              const dueMs = parseInt(task.due_date, 10);
              memberTaskCounts[key].withDueDate += 1;
              // Give 24h grace period (due_date is usually end of day)
              if (doneMs <= dueMs + 24 * 60 * 60 * 1000) {
                memberTaskCounts[key].onTime += 1;
              } else {
                memberTaskCounts[key].late += 1;
              }
            }
          }
        }

        // Stop if last page or if tasks are too old
        hasMore = !data.last_page && tasks.length > 0;
        page++;
        // Safety: max 5 pages per list
        if (page >= 5) break;
      }

      results.push({ list: list.name, status: "ok", tasksFound: totalTasks });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[ClickUp Sync] Error for list ${list.name}:`, message);
      results.push({ list: list.name, status: "error", tasksFound: 0, error: message });
    }
  }

  // Save each member's task count as a metricsSnapshot
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [memberId, data] of Object.entries(memberTaskCounts)) {
    try {
      await db.insert(metricsSnapshots).values({
        date: today,
        entityType: "clickup_member",
        entityId: 0,
        source: "manual",
        extraData: {
          memberId,
          memberName: data.name,
          tasksCompleted: data.count,
          tasksWithDueDate: data.withDueDate,
          tasksOnTime: data.onTime,
          tasksLate: data.late,
          pctOnTime: data.withDueDate > 0
            ? Math.round((data.onTime / data.withDueDate) * 10000) / 100
            : null,
          lists: data.lists,
          periodDays: 30,
        },
      });
    } catch (err) {
      console.error(`[ClickUp Sync] Error saving member ${data.name}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    syncedAt: new Date().toISOString(),
    membersSynced: Object.keys(memberTaskCounts).length,
    results,
  });
}
