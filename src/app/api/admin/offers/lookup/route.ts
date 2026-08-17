import { NextResponse } from "next/server";
import { eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { lookupOffer } from "@/lib/offers/lookup.mjs";

// GET /api/admin/offers/lookup
// Authorization: Bearer <CRON_SECRET>
//
// A volta do POST /api/admin/offer-domains: o agente grava o domínio e depois consegue LER
// de novo em vez de perguntar "qual é o link?" na próxima vez.
//
// Query params (um dos dois — ?id ganha de ?name, igual offerId ganha de offerName no POST):
//   ?id=12            — match exato pelo offer_tracking.id
//   ?name=alpha       — ILIKE %alpha% (mesmo casamento do POST); ambíguo devolve 409 com as candidatas
//
// Respostas:
//   200 { success, matchedBy: "id"|"name", offer: {...siteUrls completo} }
//   400 MISSING_IDENTIFIER | INVALID_ID | INVALID_NAME
//   401 UNAUTHORIZED
//   404 OFFER_NOT_FOUND        — com hint ensinando como achar o id certo
//   409 OFFER_NAME_AMBIGUOUS   — candidatas; a rota NÃO escolhe por você
//
// Resolução, projeção (allowlist — sem campo de pessoa, sem observations) e mensagens vivem em
// @/lib/offers/lookup.mjs; aqui só mora o acesso ao banco.

export const dynamic = "force-dynamic";

// Allowlist também no SELECT: coluna que não está aqui nem sai do Postgres.
const offerColumns = {
  id: offerTracking.id,
  name: offerTracking.name,
  language: offerTracking.language,
  ticket: offerTracking.ticket,
  gender: offerTracking.gender,
  adFormat: offerTracking.adFormat,
  copyVslStatus: offerTracking.copyVslStatus,
  copyCriativosStatus: offerTracking.copyCriativosStatus,
  vslInVturb: offerTracking.vslInVturb,
  campaignsActive: offerTracking.campaignsActive,
  validation: offerTracking.validation,
  preScale: offerTracking.preScale,
  scale: offerTracking.scale,
  productCreated: offerTracking.productCreated,
  productApproved: offerTracking.productApproved,
  siteCreated: offerTracking.siteCreated,
  adsEditedCount: offerTracking.adsEditedCount,
  adsRejectedCount: offerTracking.adsRejectedCount,
  siteUrls: offerTracking.siteUrls,
  siteUrl: offerTracking.siteUrl,
  createdAt: offerTracking.createdAt,
  updatedAt: offerTracking.updatedAt,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await lookupOffer({
    authHeader: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
    params: { id: searchParams.get("id"), name: searchParams.get("name") },
    findById: async (id) => {
      const [row] = await db
        .select(offerColumns)
        .from(offerTracking)
        .where(eq(offerTracking.id, id))
        .limit(1);
      return row ?? null;
    },
    findByName: async (name) =>
      db
        .select(offerColumns)
        .from(offerTracking)
        .where(ilike(offerTracking.name, `%${name}%`))
        .orderBy(offerTracking.id),
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
