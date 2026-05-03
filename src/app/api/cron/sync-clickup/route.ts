import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { eq } from "drizzle-orm";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

// All lists in the NGV Digital workspace.
// `categoryByTaskName: true` means the list mixes work types — derive the category
// from each task's name instead of the folder prefix.
type ListConfig = { id: string; name: string; categoryByTaskName?: boolean };
const LISTS: ListConfig[] = [
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
  // Produção de Ofertas — single list mixing Copy/Edição/Dev/Tráfego/Outros work
  { id: "901326908721", name: "Produção de Ofertas > Projetos de Oferta", categoryByTaskName: true },
];

// Infer category from a task name when the list mixes work types.
// Order matters: more specific patterns first.
function categoryFromTaskName(name: string): string {
  const n = name.toLowerCase();
  // Tráfego: tasks named "Ads - <person> ..."
  if (/^\s*ads\b/.test(n)) return "Tráfego";
  // Edição: editing/reviewing video work
  if (/edi[cç][aã]o\s+(da|dos|de)/.test(n)) return "Edição";
  if (/revis[aã]o\s+da\s+(edi[cç][aã]o|vsl)/.test(n)) return "Edição";
  // Dev: pages, pixels, scripts, A/B test, dev info, putting VSL in site
  if (/\bp[aá]gina|\bpixel|script|colocar\s+vsl|teste\s+a\/?b|informa[cç][oõ]es\s+pro?\s+dev/.test(n)) return "Dev";
  // Copy: writing/translating VSL
  if (/(escrita|tradu[cç][aã]o)\s+da\s+vsl/.test(n)) return "Copy";
  // Anything else (validations, approvals, product reviews, generic reviews, template) → Outros
  return "Outros";
}

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

// How far back to fetch completed tasks. 90 days gives us "Mês passado" + buffer.
const HISTORY_DAYS = 90;
const MS_DAY = 24 * 60 * 60 * 1000;
// Grace period for on-time check: ClickUp due_date is midnight, so "next day delivery"
// counts as on time.
const ON_TIME_GRACE_MS = 48 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CLICKUP_API_KEY not configured" }, { status: 500 });
  }

  const now = new Date();
  const cutoffMs = now.getTime() - HISTORY_DAYS * MS_DAY;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartMs = monthStart.getTime();

  type TaskRow = {
    taskId: string;
    taskName: string;
    listId: string;
    listName: string;
    category: string;
    memberId: string;
    memberName: string;
    doneMs: number;
    dueMs: number | null;
    onTime: boolean | null;
    // The "date" we file this task under for filtering. Prefer due_date so the team
    // performance "by deadline" filters work; fall back to done date if no deadline.
    filterMs: number;
  };

  const taskRows: TaskRow[] = [];
  const results: { list: string; status: string; tasksFound: number; error?: string }[] = [];

  // Member-level aggregate kept for backward compatibility (current month only)
  const memberMonthly: Record<string, {
    name: string;
    count: number;
    byCategory: Record<string, number>;
    withDueDate: number;
    onTime: number;
    late: number;
    lists: string[];
  }> = {};

  for (const list of LISTS) {
    let totalTasks = 0;
    try {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        // ClickUp default order is DESC (newest first). We rely on that so we can break
        // when we cross the cutoff. Don't pass reverse=true here (it sorts ASC).
        // Accept both `complete` (English status) and `finalizado` (Portuguese status, used
        // in the newer Produção de Ofertas folder).
        const url = `${CLICKUP_API_BASE}/list/${list.id}/task?include_closed=true&statuses[]=complete&statuses[]=finalizado&page=${page}&subtasks=true&order_by=date_done`;
        const res = await fetch(url, {
          headers: { Authorization: apiKey },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`ClickUp API failed (${res.status}): ${text}`);
        }

        const data = (await res.json()) as ClickUpResponse;
        const tasks = data.tasks || [];

        let reachedCutoff = false;

        for (const task of tasks) {
          const doneMs = task.date_done ? parseInt(task.date_done, 10)
            : task.date_closed ? parseInt(task.date_closed, 10)
            : 0;

          // Tasks come ordered by date_done desc — once we cross the cutoff we can stop
          if (doneMs > 0 && doneMs < cutoffMs) {
            reachedCutoff = true;
            break;
          }
          if (doneMs === 0) continue;

          totalTasks++;
          const category = list.categoryByTaskName
            ? categoryFromTaskName(task.name)
            : list.name.split(" > ")[0];
          const dueMs = task.due_date ? parseInt(task.due_date, 10) : null;
          const onTime = dueMs != null ? doneMs <= dueMs + ON_TIME_GRACE_MS : null;
          // Use due date when available (matches what Pedro asked for: filter by deadline),
          // fall back to done date so the row still shows up in some bucket.
          const filterMs = dueMs ?? doneMs;

          for (const assignee of task.assignees) {
            const memberId = String(assignee.id);
            const memberName = assignee.username || assignee.email || `User ${memberId}`;

            taskRows.push({
              taskId: task.id,
              taskName: task.name,
              listId: list.id,
              listName: list.name,
              category,
              memberId,
              memberName,
              doneMs,
              dueMs,
              onTime,
              filterMs,
            });

            // Monthly aggregate (only count tasks completed in current month)
            if (doneMs >= monthStartMs) {
              if (!memberMonthly[memberId]) {
                memberMonthly[memberId] = {
                  name: memberName,
                  count: 0,
                  byCategory: {},
                  withDueDate: 0,
                  onTime: 0,
                  late: 0,
                  lists: [],
                };
              }
              memberMonthly[memberId].count += 1;
              memberMonthly[memberId].byCategory[category] =
                (memberMonthly[memberId].byCategory[category] || 0) + 1;
              if (!memberMonthly[memberId].lists.includes(list.name)) {
                memberMonthly[memberId].lists.push(list.name);
              }
              if (onTime != null) {
                memberMonthly[memberId].withDueDate += 1;
                if (onTime) memberMonthly[memberId].onTime += 1;
                else memberMonthly[memberId].late += 1;
              }
            }
          }
        }

        // Stop if cutoff reached, last page, or empty
        hasMore = !reachedCutoff && !data.last_page && tasks.length > 0;
        page++;
        // Safety: max 20 pages per list (ClickUp returns 100/page → up to 2k tasks per list)
        if (page >= 20) break;
      }

      results.push({ list: list.name, status: "ok", tasksFound: totalTasks });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[ClickUp Sync] Error for list ${list.name}:`, message);
      results.push({ list: list.name, status: "error", tasksFound: 0, error: message });
    }
  }

  // Replace per-task snapshots atomically: delete old clickup_task rows, then insert fresh.
  await db.delete(metricsSnapshots).where(eq(metricsSnapshots.entityType, "clickup_task"));

  if (taskRows.length > 0) {
    const rowsToInsert = taskRows.map((r) => ({
      date: new Date(r.filterMs),
      entityType: "clickup_task",
      entityId: parseInt(r.memberId) || 0,
      source: "manual" as const,
      extraData: {
        taskId: r.taskId,
        taskName: r.taskName,
        listId: r.listId,
        listName: r.listName,
        category: r.category,
        memberId: r.memberId,
        memberName: r.memberName,
        doneAt: r.doneMs,
        dueDate: r.dueMs,
        onTime: r.onTime,
      },
    }));
    // Insert in chunks to avoid Postgres parameter limits
    const CHUNK = 500;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
      await db.insert(metricsSnapshots).values(rowsToInsert.slice(i, i + CHUNK));
    }
  }

  // Save monthly aggregate snapshot per member (backward compatibility)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [memberId, data] of Object.entries(memberMonthly)) {
    try {
      await db.insert(metricsSnapshots).values({
        date: today,
        entityType: "clickup_member",
        entityId: parseInt(memberId) || 0,
        source: "manual",
        extraData: {
          memberId,
          memberName: data.name,
          tasksCompleted: data.count,
          tasksByCategory: data.byCategory,
          tasksWithDueDate: data.withDueDate,
          tasksOnTime: data.onTime,
          tasksLate: data.late,
          pctOnTime: data.withDueDate > 0
            ? Math.round((data.onTime / data.withDueDate) * 10000) / 100
            : null,
          lists: data.lists,
          period: "month",
          periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        },
      });
    } catch (err) {
      console.error(`[ClickUp Sync] Error saving member ${data.name}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    syncedAt: new Date().toISOString(),
    historyDays: HISTORY_DAYS,
    tasksIndexed: taskRows.length,
    membersSyncedMonthly: Object.keys(memberMonthly).length,
    results,
  });
}
