import { NextResponse } from "next/server";
import { db } from "@/db";
import { creatives } from "@/db/schema";
import { describeRowErrorForLog, importSheetRows } from "@/lib/webhooks/google-sheets-import.mjs";

// POST /api/webhooks/google-sheets
// x-webhook-secret: <GOOGLE_SHEETS_WEBHOOK_SECRET>
//
// Respostas (decisão de status e justificativa completa em @/lib/webhooks/google-sheets-import.mjs):
//   200 { success: true,  received, imported, failed: 0 }              — importou tudo
//   200 { success: false, code: "PARTIAL_IMPORT", ... }                — parcial: parte foi PERSISTIDA, repetir duplicaria
//   400 INVALID_JSON | INVALID_PAYLOAD                                 — nem tentou linha nenhuma
//   401 Unauthorized · 500 secret não configurado no servidor
//   422 PAYLOAD_REJECTED  — nada importou, e toda falha é do payload
//   500 NOTHING_IMPORTED  — nada importou, e ao menos uma falha é do lado servidor
//
// Invariante: 5xx só sai quando `imported === 0`. `db.insert(creatives)` não tem
// onConflictDoNothing, então reenviar o lote depois de um 5xx nunca pode duplicar linha.
//
// Estado real hoje: `creatives.project_id` é NOT NULL REFERENCES projects(id) e `projects` está
// vazia por decisão registrada (src/app/(dashboard)/import/actions.ts:51) — todo insert viola a
// FK e esta rota responde 500 NOTHING_IMPORTED. Antes respondia 200 `{ success: true, imported: 0 }`.

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const result = await importSheetRows({
    body,
    insertRow: async (row) => {
      await db.insert(creatives).values({
        projectId: row.projectId,
        // O enum é do Postgres — ele é a fonte da verdade e recusa valor fora da lista. O cast
        // não esconde nada: valor inválido vira erro de linha (SQLSTATE 22P02) e aparece em
        // errors[] com callerFixable: true, em vez de ser engolido como antes.
        platform: row.platform as SheetRow["platform"],
        format: row.format as SheetRow["format"],
        videoLink: row.videoLink,
        status: "rascunho",
      });
    },
    // Erro cru só no log do servidor: o `.message` do drizzle carrega o SQL e os PARAMS da linha
    // (drizzle-orm/errors.js), e era exatamente isso que a resposta HTTP devolvia antes.
    logRowError: ({ row, error }) => {
      console.error(`[google-sheets] linha ${row} falhou:`, describeRowErrorForLog(error));
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
