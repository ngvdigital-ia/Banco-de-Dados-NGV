import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { parseMultiParam } from "@/lib/filter-utils";
import { getFilterOptions, getCreativesByFormat, getOfferCampaignSummary, getOfferAdsSummary } from "../actions";

const formatLabels: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masc",
  ugc_fem: "UGC Fem",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
};

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

  // Build lookup map: offerName → campaign summary
  const campaignMap = new Map(
    campaignData.offers.map((c) => [c.offerName, c])
  );
  const hasCampaignData = campaignData.offers.length > 0;
  const totalCampaigns = campaignData.offers.reduce((sum, c) => sum + c.activeCampaigns, 0);
  const totalCampaignSpend = campaignData.offers.reduce((sum, c) => sum + c.totalSpend, 0);

  function formatCurrency(value: number, currency: string) {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  }

  const totalOffers = offers.length;
  const totalEscalou = offers.filter((o) => Number(o.countEscalou) > 0).length;
  const totalNaoEscalou = offers.filter((o) => Number(o.countNaoValidou) > 0).length;
  const pctEscalou = totalOffers > 0 ? Math.round((totalEscalou / totalOffers) * 10000) / 100 : 0;
  const pctNaoEscalou = totalOffers > 0 ? Math.round((totalNaoEscalou / totalOffers) * 10000) / 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analise de Criativos</h1>
      <p className="text-muted-foreground">
        Veja as ofertas, seus formatos de ads e metricas de escala.
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
                <CardTitle className="text-sm text-muted-foreground">Campanhas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCampaigns}</div>
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

      {/* Offers table */}
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Copy VSL</TableHead>
                    <TableHead className="text-right">Ads Editados</TableHead>
                    <TableHead>Validacao</TableHead>
                    <TableHead>Escala</TableHead>
                    {hasCampaignData && (
                      <>
                        <TableHead className="text-right">Campanhas</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                        <TableHead className="text-right">Ads</TableHead>
                        <TableHead>Top Ad</TableHead>
                        <TableHead>Editores</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((row, i) => {
                    const isEscalou = row.validation === "SIM" && (row.scale === "SIM" || row.scale === "EM ANDAMENTO");
                    const isNaoEscalou = row.scale === "NAO" || row.scale === "NÃO" || row.validation === "NÃO DEU CERTO";
                    const campaign = campaignMap.get(row.format);
                    const adData = adsSummary.get(row.format);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.format}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.language}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.platform ? (
                            <Badge variant="secondary">{formatLabels[row.platform] ?? row.platform}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>{row.copyVsl ?? "-"}</TableCell>
                        <TableCell className="text-right">{row.adsEdited ?? 0}</TableCell>
                        <TableCell>
                          <Badge
                            variant={row.validation === "SIM" ? "default" : "outline"}
                            className={
                              row.validation === "SIM" ? "bg-emerald-600 text-white" :
                              row.validation === "EM ANDAMENTO" ? "border-amber-300 text-amber-700" :
                              row.validation === "NÃO DEU CERTO" ? "border-red-300 text-red-600" :
                              ""
                            }
                          >
                            {row.validation}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isEscalou ? (
                            <Badge className="bg-emerald-600 text-white">ESCALOU</Badge>
                          ) : isNaoEscalou ? (
                            <Badge variant="outline" className="border-red-300 text-red-600">NAO ESCALOU</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 text-amber-700">{row.scale ?? "EM ANDAMENTO"}</Badge>
                          )}
                        </TableCell>
                        {hasCampaignData && (
                          <>
                            <TableCell className="text-right">{campaign?.activeCampaigns ?? "-"}</TableCell>
                            <TableCell className="text-right text-red-500">
                              {campaign ? formatCurrency(campaign.totalSpend, campaign.currency) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {campaign ? formatCurrency(campaign.totalRevenue, campaign.currency) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {campaign?.roas != null ? `${campaign.roas}x` : "-"}
                            </TableCell>
                            <TableCell className="text-right">{adData?.totalAds ?? "-"}</TableCell>
                            <TableCell>
                              {adData ? (
                                <Badge variant="outline">{adData.topAdNumber}</Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {adData?.topAdEditors ?? "-"}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
