import { NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, alertHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeMetricValue, alertTriggers } from "@/lib/alerts-eval";
import {
  alertMetricDef,
  alertTargetByEntity,
  operatorSymbol,
  formatMetricValue,
  type AlertMetric,
} from "@/lib/alerts-config";
import { checkAgentsHealth } from "@/lib/agentes/n8n/health";
import { computeDataFreshness } from "@/lib/alerts-freshness.mjs";
import { isAuthorizedBearer } from "@/lib/auth-bearer.mjs";

export const maxDuration = 60;

// 20h: enquanto a condição persistir, no máximo 1 aviso por dia por alerta (o cron roda 1x/dia).
const COOLDOWN_MS = 20 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await db.select().from(alerts).where(eq(alerts.active, true));
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const now = new Date();
  const fired: string[] = [];
  const onCooldown: string[] = [];
  const evalErrors: { name: string; error: string }[] = [];

  for (const a of active) {
    try {
      const res = await computeMetricValue(a.metric as AlertMetric, a.entityType, a.entityId);
      const threshold = Number(a.threshold);
      if (!alertTriggers(res.value, a.operator, threshold)) continue;

      // cooldown: não re-notifica o mesmo alerta em menos de 20h
      if (a.lastTriggeredAt && now.getTime() - a.lastTriggeredAt.getTime() < COOLDOWN_MS) {
        onCooldown.push(a.name);
        continue;
      }

      const mdef = alertMetricDef(a.metric);
      const target = alertTargetByEntity(a.entityType, a.entityId);
      const currentStr = formatMetricValue(res.value, mdef?.format ?? "number", res.currency);
      const thresholdStr = formatMetricValue(threshold, mdef?.format ?? "number", res.currency);
      const message = `${mdef?.label ?? a.metric} ${operatorSymbol(a.operator)} ${thresholdStr} em ${target?.label ?? a.entityType} — atual ${currentStr}`;

      // registra o disparo + atualiza o cooldown ANTES do Slack (idempotência se o Slack falhar)
      await db.insert(alertHistory).values({
        alertId: a.id,
        currentValue: res.value != null ? String(res.value) : null,
        message,
      });
      await db.update(alerts).set({ lastTriggeredAt: now }).where(eq(alerts.id, a.id));

      if (webhookUrl) {
        await sendSlackAlert(webhookUrl, {
          name: a.name,
          line: message,
          target: target?.label ?? a.entityType,
          asOf: res.asOf,
          freshness: computeDataFreshness(res.asOf, now),
        });
      }
      fired.push(a.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[check-alerts] erro no alerta "${a.name}":`, err);
      evalErrors.push({ name: a.name, error: message });
    }
  }

  // Saúde dos agentes — detecção de silêncio anômalo.
  // `checked` distingue "checagem rodou e não achou nada" (silentCount: 0, checked: true)
  // de "a checagem em si quebrou" (checked: false) — as duas não podem parecer iguais,
  // senão o vigia fica surdo justo quando mais precisa avisar.
  let silentCount = 0;
  let agentsHealthChecked = true;
  let agentsHealthError: string | undefined;
  try {
    const health = await checkAgentsHealth();
    silentCount = health.silent.length;

    if (health.silent.length > 0 && webhookUrl) {
      await sendAgentsHealthAlert(webhookUrl, health.silent);
    }
  } catch (err) {
    agentsHealthChecked = false;
    agentsHealthError = err instanceof Error ? err.message : "Unknown error";
    console.error("[check-alerts] falha ao checar saúde dos agentes:", err);
  }

  return NextResponse.json({
    success: true,
    evaluated: active.length,
    fired,
    onCooldown,
    evalErrors,
    agentsHealth: {
      silentCount,
      checked: agentsHealthChecked,
      ...(agentsHealthError ? { error: agentsHealthError } : {}),
    },
    at: now.toISOString(),
  });
}

async function sendAgentsHealthAlert(
  url: string,
  silent: { name: string; lastSuccessAt: string | null; hoursSilent: number | null }[],
) {
  const n8nUrl = process.env.N8N_BASE_URL ?? "https://n8n.example.com";
  const lines = silent
    .map((s) => {
      const horas =
        s.hoursSilent !== null
          ? `${s.hoursSilent}h sem execução bem-sucedida`
          : "sem nenhuma execução bem-sucedida recente";
      return `• *${s.name}* — ${horas}`;
    })
    .join("\n");

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🤖 Agente em silêncio anômalo",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: lines,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Verificar execuções no n8n: <${n8nUrl}|abrir n8n>`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
      console.error(
        "[check-alerts] Slack (saúde agentes) respondeu",
        res.status,
        await res.text(),
      );
  } catch (err) {
    console.error("[check-alerts] falha ao enviar alerta de saúde dos agentes:", err);
  }
}

async function sendSlackAlert(
  url: string,
  a: {
    name: string;
    line: string;
    target: string;
    asOf: Date | null;
    freshness: { ageDays: number | null; isStale: boolean };
  },
) {
  const dashboardUrl = "https://banco-de-dados-ngv.vercel.app/alertas";
  const asOfStr = a.asOf ? a.asOf.toISOString().slice(0, 10) : "—";
  // Dado velho não muda se o alerta dispara (o número velho ainda pode ser um problema
  // real) — só deixa explícito, pra quem lê saber que o número pode não valer mais.
  const freshnessLine = a.freshness.isStale
    ? `\n⚠️ Dado atrasado — ${a.freshness.ageDays ?? "?"} ${a.freshness.ageDays === 1 ? "dia" : "dias"} sem sincronizar, o valor acima pode não valer mais`
    : "";
  const message = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🚨 Alerta: ${a.name}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${a.line}*\n_Dado de: ${asOfStr}_${freshnessLine}` },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Alvo: ${a.target}` },
          { type: "mrkdwn", text: `<${dashboardUrl}|Ver alertas no dashboard>` },
        ],
      },
    ],
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[check-alerts] Slack respondeu", res.status, await res.text());
  } catch (err) {
    console.error("[check-alerts] falha ao enviar Slack:", err);
  }
}
