import { NextResponse } from "next/server";
import { db } from "@/db";
import { creatives } from "@/db/schema";

type SheetRow = {
  format: "especialista" | "ugc_masc" | "ugc_fem" | "famoso" | "youtuber" | "autoridade" | "podcast";
  videoLink?: string;
  copywriter?: string;
  editor?: string;
  projectId: number;
  platform: "meta" | "tiktok" | "google" | "kwai";
};

export async function POST(request: Request) {
  // Validate webhook secret
  const webhookSecret = request.headers.get("x-webhook-secret");
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured on server" }, { status: 500 });
  }
  if (webhookSecret !== process.env.GOOGLE_SHEETS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { rows: SheetRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.rows || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Expected { rows: [...] }" }, { status: 400 });
  }

  let imported = 0;
  const errors: string[] = [];

  for (const row of body.rows) {
    try {
      if (!row.format || !row.projectId || !row.platform) {
        errors.push(`Linha ignorada: faltando format, projectId ou platform`);
        continue;
      }

      await db.insert(creatives).values({
        projectId: row.projectId,
        platform: row.platform,
        format: row.format,
        videoLink: row.videoLink ?? null,
        status: "rascunho",
      });

      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Erro ao importar: ${message}`);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    errors: errors.length > 0 ? errors : undefined,
  });
}
