import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  emitDailyIngest,
  NgvCoreEmitterError,
  normalizeAggregateRow,
} from "@/lib/ngv-core/emitter.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Comparação timing-safe: digere ambos os lados com sha256 (comprimento
 * normalizado) antes do timingSafeEqual — evita leak por tamanho da string.
 */
function secureEqual(a: string | null, b: string | null): boolean {
  const left = createHash("sha256").update(a ?? "").digest();
  const right = createHash("sha256").update(b ?? "").digest();
  return timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || !secureEqual(authHeader, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fail-closed: sem WRITER_KEY, 503 ANTES de tocar banco ou rede.
  if (!process.env.NGV_CORE_WRITER_KEY) {
    return NextResponse.json(
      { error: "NGV_CORE_WRITER_KEY not configured" },
      { status: 503 },
    );
  }

  try {
    // Única query agregada read-only: 4 subselects em 1 round-trip.
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM offer_tracking)             AS offer_tracking_count,
        (SELECT COUNT(*) FROM metrics_snapshots)          AS metrics_snapshot_count,
        (SELECT MAX(created_at) FROM metrics_snapshots)   AS latest_metric_at,
        (SELECT MAX(created_at) FROM offer_tracking)      AS latest_offer_at
    `);

    const aggregate = normalizeAggregateRow(rows.rows[0]);
    const result = await emitDailyIngest(aggregate);

    return NextResponse.json({ success: true, received: result });
  } catch (error) {
    // Nunca ecoa apikey/payload; expõe só o código do erro.
    const code = error instanceof NgvCoreEmitterError ? error.code : "NGV_CORE_INTERNAL";
    console.error(`[NGV Core] ingest failed: ${code}`);
    return NextResponse.json({ error: code }, { status: 500 });
  }
}
