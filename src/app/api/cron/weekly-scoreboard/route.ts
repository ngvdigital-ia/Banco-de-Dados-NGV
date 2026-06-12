import { NextResponse } from "next/server";
import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

export const maxDuration = 60;

const DASHBOARD_URL = "https://banco-de-dados-ngv.vercel.app/analytics/team";

/** Retorna o timestamp (ms) da segunda-feira da semana corrente às 00:00 BRT (UTC-3). */
function getMondayStartMs(): number {
  const now = new Date();
  // Ajusta para BRT (UTC-3): subtrai 3h do UTC para obter o "dia local"
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dayOfWeek = brtNow.getUTCDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  // Segunda-feira local às 00:00 BRT = 03:00 UTC
  const mondayBrtMidnight = new Date(brtNow);
  mondayBrtMidnight.setUTCDate(brtNow.getUTCDate() - daysFromMonday);
  mondayBrtMidnight.setUTCHours(0, 0, 0, 0);
  // Converte de volta para UTC real: BRT midnight = UTC 03:00
  return mondayBrtMidnight.getTime() + 3 * 60 * 60 * 1000;
}

/** Formata timestamp ms em DD/MM BRT. */
function fmtDate(ms: number): string {
  const d = new Date(ms - 3 * 60 * 60 * 1000); // ajusta pra BRT
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const segundaMs = getMondayStartMs();

  // Busca tarefas concluídas na semana (doneAt >= segunda-feira 00:00 BRT, campo epoch ms em string)
  const rows = await db
    .select({
      memberName: sql<string>`${metricsSnapshots.extraData}->>'memberName'`,
      category: sql<string>`${metricsSnapshots.extraData}->>'category'`,
    })
    .from(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.entityType, "clickup_task"),
        isNotNull(sql`${metricsSnapshots.extraData}->>'doneAt'`),
        sql`(${metricsSnapshots.extraData}->>'doneAt')::bigint >= ${segundaMs}`,
      ),
    )
    .limit(1000);

  // Agrupa por membro e categoria
  type MemberStats = {
    total: number;
    byCategory: Record<string, number>;
  };
  const byMember = new Map<string, MemberStats>();

  for (const row of rows) {
    const name = row.memberName ?? "Desconhecido";
    const cat = row.category ?? "Outros";
    if (!byMember.has(name)) {
      byMember.set(name, { total: 0, byCategory: {} });
    }
    const stats = byMember.get(name)!;
    stats.total += 1;
    stats.byCategory[cat] = (stats.byCategory[cat] ?? 0) + 1;
  }

  // Ranking ordenado desc por total
  const ranking = Array.from(byMember.entries())
    .sort((a, b) => b[1].total - a[1].total);

  const hoje = Date.now();
  const periodoStr = `Seg ${fmtDate(segundaMs)} – hoje ${fmtDate(hoje)}`;

  let message: object;

  if (ranking.length === 0) {
    message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🏆 Placar da semana — Entregas do time",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Nenhuma entrega registrada esta semana ainda.",
          },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: periodoStr },
            { type: "mrkdwn", text: `<${DASHBOARD_URL}|Ver dashboard do time>` },
          ],
        },
      ],
    };
  } else {
    const lines = ranking.map(([name, stats], idx) => {
      const medal = idx < 3 ? MEDALS[idx] : `*${idx + 1}º*`;
      const breakdownParts = Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `${cat} ${count}`)
        .join(" · ");
      const breakdown = breakdownParts ? ` (${breakdownParts})` : "";
      return `${medal} *${name}* — ${stats.total} tarefas${breakdown}`;
    });

    message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🏆 Placar da semana — Entregas do time",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: lines.join("\n"),
          },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: periodoStr },
            { type: "mrkdwn", text: `<${DASHBOARD_URL}|Ver dashboard do time>` },
          ],
        },
      ],
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Slack error: ${text}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Weekly scoreboard sent",
      membersRanked: ranking.length,
      tasksTotal: rows.length,
      period: periodoStr,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
