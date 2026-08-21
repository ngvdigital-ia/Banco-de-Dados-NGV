import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NgvCoreEmitterError } from "@/lib/ngv-core/emitter.mjs";
import { emitCatalogSnapshot } from "@/lib/ngv-core/catalog-emitter.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Igual ao emissor agregado: digere os dois lados antes do timingSafeEqual. */
function secureEqual(a: string | null, b: string | null): boolean {
  const left = createHash("sha256").update(a ?? "").digest();
  const right = createHash("sha256").update(b ?? "").digest();
  return timingSafeEqual(left, right);
}

/**
 * Publica o catálogo de ofertas do Banco no NGV Core (source_system="banco_ngv").
 *
 * Complementa /api/cron/sync-ngv-core, que manda só CONTAGENS. Aqui vão as ofertas
 * linha a linha, porque o Banco é o registro central de oferta da operação e sem
 * essas linhas nenhuma leitura por oferta consegue partir dele.
 *
 * Snapshot completo de propósito: o ingest do Core apaga o snapshot anterior desta
 * fonte e reinsere inteiro, então oferta apagada no Banco some do Core sozinha. Delta
 * não teria essa propriedade.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || !secureEqual(authHeader, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fail-closed: sem credencial, 503 ANTES de tocar banco ou rede.
  const writerKey = process.env.NGV_CORE_BANCO_WRITER_KEY ?? process.env.NGV_CORE_WRITER_KEY;
  if (!writerKey) {
    return NextResponse.json({ error: "NGV_CORE_WRITER_KEY not configured" }, { status: 503 });
  }

  try {
    const rows = await db.execute(sql`
      SELECT id, name, validation, created_at, updated_at
      FROM offer_tracking
      ORDER BY id
    `);

    const result = await emitCatalogSnapshot(rows.rows);

    // Oferta pulada não derruba o envio, mas não pode sumir em silêncio: quem foi
    // ignorado vira log nomeado, para não virar "sumiu do catálogo e ninguém viu".
    if (result.ignoradas.length > 0) {
      console.warn("[NGV Core] ofertas ignoradas no catalogo:", result.ignoradas);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // Nunca ecoa credencial nem payload; expõe só o código.
    const code = error instanceof NgvCoreEmitterError ? error.code : "NGV_CORE_INTERNAL";
    console.error(`[NGV Core] catalog ingest failed: ${code}`);
    return NextResponse.json({ error: code }, { status: 502 });
  }
}
