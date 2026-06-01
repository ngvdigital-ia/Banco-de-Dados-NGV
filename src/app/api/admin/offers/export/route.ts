import { NextResponse } from "next/server";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { requireAdmin, AdminAuthError } from "@/lib/admin-auth";

// GET /api/admin/offers/export
// Authorization: Bearer <CRON_SECRET>
//
// Aceita os mesmos filtros de getOffers:
//   ?language=EN
//   ?validation=SIM
//   ?copywriter=<nome>
//   ?monthFrom=2026-03
//   ?monthTo=2026-04
//
// Retorna text/csv com as colunas principais da oferta.

export async function GET(request: Request) {
  // Autenticação via requireAdmin (Clerk) — esta route é para admins do dashboard
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const validation = searchParams.get("validation");
  const copywriter = searchParams.get("copywriter");
  const monthFrom = searchParams.get("monthFrom");
  const monthTo = searchParams.get("monthTo");

  const conditions = [];

  if (language) {
    conditions.push(eq(offerTracking.language, language));
  }
  if (validation) {
    conditions.push(eq(offerTracking.validation, validation));
  }
  if (copywriter) {
    conditions.push(eq(offerTracking.copyVsl, copywriter));
  }
  if (monthFrom) {
    const [y, m] = monthFrom.split("-").map(Number);
    conditions.push(gte(offerTracking.createdAt, new Date(y, m - 1, 1)));
  }
  if (monthTo) {
    const [y, m] = monthTo.split("-").map(Number);
    conditions.push(lt(offerTracking.createdAt, new Date(y, m, 1)));
  }

  const rows = await db
    .select({
      id: offerTracking.id,
      name: offerTracking.name,
      language: offerTracking.language,
      copyVsl: offerTracking.copyVsl,
      copyAds: offerTracking.copyAds,
      editorVsl: offerTracking.editorVsl,
      editorAds: offerTracking.editorAds,
      ticket: offerTracking.ticket,
      copyVslStatus: offerTracking.copyVslStatus,
      copyCriativosStatus: offerTracking.copyCriativosStatus,
      vslInVturb: offerTracking.vslInVturb,
      adsEditedCount: offerTracking.adsEditedCount,
      adsRejectedCount: offerTracking.adsRejectedCount,
      campaignsActive: offerTracking.campaignsActive,
      validation: offerTracking.validation,
      preScale: offerTracking.preScale,
      scale: offerTracking.scale,
      productCreated: offerTracking.productCreated,
      productApproved: offerTracking.productApproved,
      siteCreated: offerTracking.siteCreated,
      gender: offerTracking.gender,
      adFormat: offerTracking.adFormat,
      observations: offerTracking.observations,
      createdAt: offerTracking.createdAt,
    })
    .from(offerTracking)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(offerTracking.createdAt))
    .limit(500);

  // Monta CSV
  const headers = [
    "id",
    "name",
    "language",
    "copyVsl",
    "copyAds",
    "editorVsl",
    "editorAds",
    "ticket",
    "copyVslStatus",
    "copyCriativosStatus",
    "vslInVturb",
    "adsEditedCount",
    "adsRejectedCount",
    "campaignsActive",
    "validation",
    "preScale",
    "scale",
    "productCreated",
    "productApproved",
    "siteCreated",
    "gender",
    "adFormat",
    "observations",
    "createdAt",
  ];

  function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Envolve em aspas se contiver vírgula, aspas ou quebra de linha
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    const cells = [
      row.id,
      row.name,
      row.language,
      row.copyVsl,
      row.copyAds,
      row.editorVsl,
      row.editorAds,
      row.ticket,
      row.copyVslStatus,
      row.copyCriativosStatus,
      row.vslInVturb,
      row.adsEditedCount,
      row.adsRejectedCount,
      row.campaignsActive,
      row.validation,
      row.preScale,
      row.scale,
      row.productCreated,
      row.productApproved,
      row.siteCreated,
      row.gender,
      row.adFormat,
      row.observations,
      row.createdAt?.toISOString() ?? "",
    ];
    lines.push(cells.map(escapeCell).join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `offers-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
