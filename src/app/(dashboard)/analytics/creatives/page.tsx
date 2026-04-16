import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { parseMultiParam } from "@/lib/filter-utils";
import { getFilterOptions, getCreativesByFormat, getOfferCampaignSummary, getOfferAdsSummary } from "../actions";
import { CreativesTable } from "@/components/analytics/creatives-table";

export default async function CreativesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters = {
    languages: parseMultiParam(params.language),
    formats: parseMultiParam(params.format),
    statuses: parseMultiParam(params.status),
  };

  const creativeFilters = {
    language: filters.languages.length > 0 ? filters.languages[0] : undefined,
    format: filters.formats.length > 0 ? filters.formats[0] : undefined,
    validation: filters.statuses.length > 0 ? filters.statuses[0] : undefined,
  };

  const [options, offers, campaignData, adsSummary] = await Promise.all([
    getFilterOptions(),
    getCreativesByFormat(creativeFilters),
    getOfferCampaignSummary(),
    getOfferAdsSummary(),
  ]);

  const campaignMap: Record<string, { activeCampaigns: number; totalSpend: number; totalRevenue: number; roas: number | null; currency: string }> = {};
  for (const c of campaignData.offers) {
    campaignMap[c.offerName] = c;
  }

  // Convert Map to plain object for client component
  const adsMapObj: Record<string, { adNumber: string; spend: number; revenue: number; profit: number; roas: number | null; editors: string; variantCount: number; adFormat: string | null }[]> = {};
  for (const [key, value] of adsSummary) {
    adsMapObj[key] = value;
  }

  const hasCampaignData = campaignData.offers.length > 0;
  const totalCampaigns = campaignData.offers.reduce((sum, c) => sum + c.activeCampaigns, 0);
  const totalCampaignSpend = campaignData.offers.reduce((sum, c) => sum + c.totalSpend, 0);
  const totalAds = Array.from(adsSummary.values()).reduce((sum, ads) => sum + ads.length, 0);

  function formatCurrency(value: number, currency: string) {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  }

  const totalOffers = offers.length;
  const totalEscalou = offers.filter((o) => Number(o.countEscalou) > 0).length;
  const totalNaoEscalou = offers.filter((o) => Number(o.countNaoValidou) > 0).length;
  const pctEscalou = totalOffers > 0 ? Math.round((totalEscalou / totalOffers) * 10000) / 100 : 0;
  const pctNaoEscalou = totalOffers > 0 ? Math.round((totalNaoEscalou / totalOffers) * 10000) / 100 : 0;

  const offerRows = offers.map((o) => ({
    format: o.format,
    platform: o.platform,
    language: o.language,
    adsEdited: o.adsEdited,
    validation: o.validation,
    scale: o.scale,
    copyVsl: o.copyVsl,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analise de Criativos</h1>
      <p className="text-muted-foreground">
        Clique numa oferta para ver os ads da UTMify. Selecione o formato de cada ad.
      </p>

      <Suspense fallback={<div className="h-8" />}>
        <AnalyticsFilters
          options={{
            niches: [],
            languages: options.languages,
            copywriters: [],
            editors: [],
            formats: options.formats,
            statuses: ["SIM", "NAO", "EM ANDAMENTO", "NÃO DEU CERTO"],
          }}
          showFormats={true}
          showEditors={false}
        />
      </Suspense>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOffers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% Escalou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{pctEscalou}%</div>
            <p className="text-xs text-muted-foreground">{totalEscalou} ofertas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% Nao Escalou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{pctNaoEscalou}%</div>
            <p className="text-xs text-muted-foreground">{totalNaoEscalou} ofertas</p>
          </CardContent>
        </Card>
        {hasCampaignData && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Campanhas / Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCampaigns} / {totalAds}</div>
                <p className="text-xs text-muted-foreground">via UTMify</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Gasto Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {formatCurrency(totalCampaignSpend, campaignData.offers[0]?.currency ?? "USD")}
                </div>
                {campaignData.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Atualizado: {campaignData.lastSync.toLocaleDateString("pt-BR")}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Offers table with expandable ads */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Oferta</CardTitle>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma oferta encontrada com os filtros selecionados.
            </p>
          ) : (
            <CreativesTable
              offers={offerRows}
              campaignMap={campaignMap}
              adsMap={adsMapObj}
              hasCampaignData={hasCampaignData}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
