import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { parseMultiParam } from "@/lib/filter-utils";
import { getDateRange } from "@/lib/date-utils";
import { getFilterOptions, getCreativesByFormat, getOfferCampaignSummary, getOfferAdsSummary } from "../actions";
import { CreativesTable } from "@/components/analytics/creatives-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Megaphone } from "lucide-react";

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

  const period = typeof params.period === "string" ? params.period : "all";
  const { from, to } = getDateRange(period);
  const dateFrom = period === "all" ? undefined : from.toISOString();
  const dateTo = period === "all" ? undefined : to.toISOString();

  const creativeFilters = {
    language: filters.languages.length > 0 ? filters.languages[0] : undefined,
    format: filters.formats.length > 0 ? filters.formats[0] : undefined,
    validation: filters.statuses.length > 0 ? filters.statuses[0] : undefined,
  };

  const [options, offers, campaignData, adsSummary] = await Promise.all([
    getFilterOptions(),
    getCreativesByFormat(creativeFilters, dateFrom, dateTo),
    getOfferCampaignSummary(dateFrom, dateTo),
    getOfferAdsSummary(dateFrom, dateTo),
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
    <div className="space-y-8">
      <PageHeader
        title="Análise de Criativos"
        description="Clique numa oferta para ver os ads da UTMify. Selecione o formato de cada ad."
      />

      <p className="text-xs text-muted-foreground -mt-4">
        Período &quot;Tudo&quot; mostra o total acumulado (última sincronização UTMify). Outros períodos usam snapshots diários coletados automaticamente desde a ativação do cron.
      </p>

      <Suspense fallback={<div className="h-8" />}>
        <div className="space-y-3">
          <DateRangeFilter />
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
        </div>
      </Suspense>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{totalOffers}</div>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-success border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">% Escalou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold text-success">{pctEscalou}%</div>
            <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">{totalEscalou} ofertas</p>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-danger border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">% Não Escalou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold text-danger">{pctNaoEscalou}%</div>
            <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">{totalNaoEscalou} ofertas</p>
          </CardContent>
        </Card>
        {hasCampaignData && (
          <>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campanhas / Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="tabular-nums text-2xl font-bold">{totalCampaigns} / {totalAds}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">via UTMify</p>
              </CardContent>
            </Card>
            <Card className="border-l-2 border-l-danger border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gasto Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="tabular-nums text-2xl font-bold text-danger">
                  {formatCurrency(totalCampaignSpend, campaignData.offers[0]?.currency ?? "USD")}
                </div>
                {campaignData.lastSync && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Atualizado: {campaignData.lastSync.toLocaleDateString("pt-BR")}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Offers table with expandable ads */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base">Detalhamento por Oferta</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {offers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Megaphone}
                title="Nenhuma oferta encontrada"
                description="Nenhuma oferta corresponde aos filtros selecionados. Tente ampliar ou remover os filtros."
              />
            </div>
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
