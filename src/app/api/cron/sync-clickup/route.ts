import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

const LISTS = [
  { id: "901323138754", name: "Outros" },
  { id: "901325026428", name: "Sites" },
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
};

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CLICKUP_API_KEY not configured" }, { status: 500 });
  }

  // 7 days ago timestamp in milliseconds
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const results: { list: string; status: string; tasksFound: number; error?: string }[] = [];
  const memberTaskCounts: Record<string, { name: string; count: number; withDueDate: number; onTime: number; lists: string[] }> = {};

  for (const list of LISTS) {
    try {
      const url = `${CLICKUP_API_BASE}/list/${list.id}/task?statuses[]=complete&date_updated_gt=${sevenDaysAgo}`;
      const res = await fetch(url, {
        headers: { Authorization: apiKey },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp API failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as ClickUpResponse;

      // Count tasks per assignee, track due dates for on-time %
      for (const task of data.tasks) {
        for (const assignee of task.assignees) {
          const key = String(assignee.id);
          if (!memberTaskCounts[key]) {
            memberTaskCounts[key] = { name: assignee.username, count: 0, withDueDate: 0, onTime: 0, lists: [] };
          }
          memberTaskCounts[key].count += 1;
          if (!memberTaskCounts[key].lists.includes(list.name)) {
            memberTaskCounts[key].lists.push(list.name);
          }

          // Calculate on-time completion
          if (task.due_date) {
            memberTaskCounts[key].withDueDate += 1;
            const dueMs = parseInt(task.due_date, 10);
            const doneMs = task.date_done ? parseInt(task.date_done, 10)
              : task.date_closed ? parseInt(task.date_closed, 10)
              : parseInt(task.date_updated, 10);
            if (doneMs <= dueMs) {
              memberTaskCounts[key].onTime += 1;
            }
          }
        }
      }

      results.push({ list: list.name, status: "ok", tasksFound: data.tasks.length });
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
          pctOnTime: data.withDueDate > 0 ? Math.round((data.onTime / data.withDueDate) * 10000) / 100 : null,
          lists: data.lists,
          periodDays: 7,
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
