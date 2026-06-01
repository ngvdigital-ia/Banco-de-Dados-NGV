import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const dashboardUrl = "https://banco-de-dados-ngv.vercel.app/offers";

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 Lembrete Diário — Acompanhamento de Ofertas",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Bom dia, equipe! 👋\n\nLembrete para preencher o *Acompanhamento de Ofertas* no dashboard.\n\n👉 <${dashboardUrl}|Abrir Dashboard>`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ Atualize o status das suas ofertas\n✅ Preencha Ads editados e rejeitados\n✅ Adicione observações relevantes",
        },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Slack error: ${text}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Slack reminder sent",
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
