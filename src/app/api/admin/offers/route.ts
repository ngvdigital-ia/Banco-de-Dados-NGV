import { NextResponse } from "next/server";
import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import type { SiteUrls } from "@/lib/site-urls";
import { totalLinks } from "@/lib/site-urls";
import { isAuthorizedBearer } from "@/lib/auth-bearer.mjs";

// GET /api/admin/offers
// Authorization: Bearer <CRON_SECRET>
//
// Retorna a lista enxuta de ofertas pra agentes externos resolverem matches
// sem depender de ILIKE genérico (que dá 409 ambíguo). Use o `id` retornado
// como `offerId` no POST /api/admin/offer-domains.
//
// Query params (opcionais):
//   ?language=DE        — filtra por idioma (EN, FR, DE, ITA, ES, PT)
//   ?validation=SIM     — só ofertas validadas
//   ?has_site_urls=true — só com URLs já configuradas
//   ?has_site_urls=false — só sem URLs (gap pra preencher)

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!isAuthorizedBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const validation = searchParams.get("validation");
  const hasSiteUrlsParam = searchParams.get("has_site_urls");

  const rows = await db
    .select({
      id: offerTracking.id,
      name: offerTracking.name,
      language: offerTracking.language,
      validation: offerTracking.validation,
      scale: offerTracking.scale,
      siteUrls: offerTracking.siteUrls,
    })
    .from(offerTracking)
    .orderBy(offerTracking.id);

  // Apply in-memory filters (small dataset, ~30 rows)
  const filtered = rows.filter((r) => {
    if (language && r.language !== language) return false;
    if (validation && r.validation !== validation) return false;
    if (hasSiteUrlsParam != null) {
      const has = totalLinks((r.siteUrls as SiteUrls | null) ?? null) > 0;
      if (hasSiteUrlsParam === "true" && !has) return false;
      if (hasSiteUrlsParam === "false" && has) return false;
    }
    return true;
  });

  const offers = filtered.map((r) => {
    const urls = (r.siteUrls as SiteUrls | null) ?? null;
    return {
      id: r.id,
      name: r.name,
      language: r.language,
      validation: r.validation,
      scale: r.scale,
      hasSiteUrls: urls != null,
      linkCount: totalLinks(urls),
      // Hint pro agente: domínio raiz se já cadastrado
      domain: urls?.domain ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    total: offers.length,
    offers,
  });
}
