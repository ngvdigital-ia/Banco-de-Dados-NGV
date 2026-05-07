import { NextResponse } from "next/server";
import { z } from "zod";
import { ilike, eq } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking, metricsSnapshots } from "@/db/schema";
import {
  type SiteUrls,
  siteUrlsSchema,
  normalizeSiteUrls,
  mergeSiteUrls,
  deriveDomain,
  vslOf,
  totalLinks,
  MAX_LINKS,
} from "@/lib/site-urls";

// POST /api/admin/offer-domains
// Authorization: Bearer <CRON_SECRET>
//
// Body:
//   {
//     offerId?: number,        // preferido — match exato
//     offerName?: string,      // fallback — ILIKE %name% (409 se ambíguo)
//     domain?: string,
//     vsl?: string,
//     whites?: string[],
//     quiz?: string,
//     custom?: { label, url }[],
//     merge?: boolean          // default true: mantém links existentes não conflitantes
//   }
//
// Comportamento:
//   - merge=true (padrão): adiciona/atualiza singletons (vsl/quiz/domain) preservando os
//     que não vieram; whites/custom usam união com dedup por URL normalizada.
//   - merge=false: substitui completamente o jsonb pelos campos do payload.
//   - Cascata: se offer_tracking.site_created é "NAO" e ela passa a ter ≥1 link, vira "SIM".
//   - Audit: cada chamada gera um row em metrics_snapshots (entityType=site_urls_webhook).

const requestSchema = z
  .object({
    offerId: z.number().int().positive().optional(),
    offerName: z.string().min(1).max(200).optional(),
    domain: z.string().trim().max(120).optional(),
    vsl: z.string().trim().min(1).optional(),
    whites: z.array(z.string().trim().min(1)).max(MAX_LINKS).optional(),
    quiz: z.string().trim().min(1).optional(),
    custom: z
      .array(z.object({ label: z.string().trim().min(1).max(80), url: z.string().trim().min(1) }))
      .max(MAX_LINKS)
      .optional(),
    merge: z.boolean().optional().default(true),
  })
  .refine((b) => b.offerId != null || b.offerName != null, {
    message: "Provide offerId or offerName",
  });

export async function POST(request: Request) {
  // 1. Auth
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // 3. Resolve offerId
  let offerId: number;
  if (body.offerId != null) {
    const [row] = await db
      .select({ id: offerTracking.id })
      .from(offerTracking)
      .where(eq(offerTracking.id, body.offerId));
    if (!row) {
      return NextResponse.json({ error: `Offer #${body.offerId} not found` }, { status: 404 });
    }
    offerId = row.id;
  } else {
    const matches = await db
      .select({ id: offerTracking.id, name: offerTracking.name })
      .from(offerTracking)
      .where(ilike(offerTracking.name, `%${body.offerName}%`));
    if (matches.length === 0) {
      return NextResponse.json(
        { error: `No offer matches name "${body.offerName}"` },
        { status: 404 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        {
          error: `Multiple offers match "${body.offerName}". Use offerId.`,
          candidates: matches.slice(0, 10),
        },
        { status: 409 },
      );
    }
    offerId = matches[0].id;
  }

  // 4. Build incoming SiteUrls from payload
  const incoming: SiteUrls = {};
  if (body.domain) incoming.domain = body.domain;
  if (body.vsl) incoming.vsl = body.vsl;
  if (body.quiz) incoming.quiz = body.quiz;
  if (body.whites?.length) incoming.whites = body.whites;
  if (body.custom?.length) incoming.custom = body.custom;

  // Validate normalized shape (rejects javascript:, etc)
  const incomingValidation = siteUrlsSchema.safeParse(incoming);
  if (!incomingValidation.success) {
    return NextResponse.json(
      { error: "URL inválida no payload", issues: incomingValidation.error.issues },
      { status: 400 },
    );
  }

  // 5. Read-modify-write sequencial (Neon HTTP driver não suporta transações).
  // Risco de race com UI é mínimo na prática (operações são raras e majoritariamente
  // additive); last-write-wins aceitável no escopo deste webhook.
  const [current] = await db
    .select({
      siteUrls: offerTracking.siteUrls,
      siteCreated: offerTracking.siteCreated,
    })
    .from(offerTracking)
    .where(eq(offerTracking.id, offerId));

  const existingUrls = (current?.siteUrls as SiteUrls | null) ?? null;
  const wasEmpty = totalLinks(existingUrls) === 0;

  const next = body.merge ? mergeSiteUrls(existingUrls, incoming) : normalizeSiteUrls(incoming);

  const finalCheck = siteUrlsSchema.safeParse(next);
  if (!finalCheck.success) {
    return NextResponse.json(
      {
        error: "Resultado excede limites",
        issues: finalCheck.error.issues,
      },
      { status: 400 },
    );
  }

  if (!next.domain) {
    const inferred = deriveDomain(next);
    if (inferred) next.domain = inferred;
  }

  const newVsl = vslOf(next) ?? null;
  const hasAnyLink = totalLinks(next) > 0;

  await db
    .update(offerTracking)
    .set({
      siteUrls: next as unknown as object,
      siteUrl: newVsl,
      ...(hasAnyLink && wasEmpty && current?.siteCreated !== "SIM"
        ? { siteCreated: "SIM" }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(offerTracking.id, offerId));

  // Audit log (best-effort — não falha o request se logar quebrar)
  try {
    await db.insert(metricsSnapshots).values({
      date: new Date(),
      entityType: "site_urls_webhook",
      entityId: offerId,
      source: "manual",
      extraData: {
        offerId,
        merge: body.merge,
        incoming,
        result: next,
        previousLinkCount: totalLinks(existingUrls),
        newLinkCount: totalLinks(next),
      },
    });
  } catch (err) {
    console.error("[offer-domains] audit log failed:", err);
  }

  const result = { siteUrls: next, siteUrl: newVsl };

  return NextResponse.json({
    success: true,
    offerId,
    merged: body.merge,
    siteUrls: result.siteUrls,
    siteUrl: result.siteUrl,
  });
}
