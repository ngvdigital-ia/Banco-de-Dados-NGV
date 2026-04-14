import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { getDateRange } from "@/lib/date-utils";
import { OfferFilter } from "@/components/filters/offer-filter";
import { getVturbStats, getUtmifyOfferMetrics } from "../actions";

function formatDuration(seconds: number | null) {
  if (!seconds) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatCurrency(value: number, currency: string) {
  if (!value) return "-";
  const num = value / 100; // UTMify returns centavos
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(num);
}

export default async function VslPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const period = typeof params.period === "string" ? params.period : "7d";
  const offerFilter = typeof params.offer === "string" ? params.offer : undefined;

  // Calculate date range
  const { from, to } = getDateRange(period);
  const dateFrom = from.toISOString().split("T")[0];
  const dateTo = to.toISOString().split("T")[0];

  // Fetch VTurb data live + UTMify from DB cache
  const [vturbStats, utmifyOffers] = await Promise.all([
    getVturbStats(dateFrom, dateTo).catch(() => [] as Awaited<ReturnType<typeof getVturbStats>>),
    getUtmifyOfferMetrics(),
  ]);

  // Build a map of offer name → UTMify metrics from DB
  const offerMetricsMap = new Map<string, typeof utmifyOffers[number]>();
  for (const m of utmifyOffers) {
    offerMetricsMap.set(m.offerName, m);
  }

  // Filter by offer if selected
  const filteredStats = offerFilter
    ? vturbStats.filter((p) => p.offerName === offerFilter)
    : vturbStats;

  // Extract unique offer names for the filter
  const offerNames = [...new Set(vturbStats.map((p) => p.offerName))].sort();

  // Summary cards from VTurb data
  const totalPlayers = filteredStats.length;
  const totalViews = filteredStats.reduce((s, p) => s + p.viewed, 0);
  const totalPlays = filteredStats.reduce((s, p) => s + p.started, 0);
  const avgPlayRate = totalViews > 0 ? Math.round((totalPlays / totalViews) * 10000) / 100 : 0;
  const durations = filteredStats.filter((p) => p.duration > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((s, p) => s + p.duration, 0) / durations.length)
    : null;
  const pitches = filteredStats.filter((p) => p.pitchTime > 0);
  const avgPitch = pitches.length > 0
    ? Math.round(pitches.reduce((s, p) => s + p.pitchTime, 0) / pitches.length)
    : null;

  // Group players by offer
  const grouped = filteredStats.reduce((acc, player) => {
    const offer = player.offerName;
    if (!acc[offer]) acc[offer] = [];
    acc[offer].push(player);
    return acc;
  }, {} as Record<string, typeof filteredStats>);

  const sortedOffers = Object.entries(grouped).sort(
    ([, a], [, b]) =>
      b.reduce((s, p) => s + p.started, 0) - a.reduce((s, p) => s + p.started, 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance de VSLs</h1>
          <p className="text-muted-foreground mt-1">
            Metricas VTurb ao vivo por oferta — views, plays, play rate e retencao ao pitch.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Suspense fallback={<div className="h-8" />}>
          <DateRangeFilter />
        </Suspense>

        {/* Offer filter */}
        <Suspense fallback={<div className="h-8" />}>
          <OfferFilter offers={offerNames} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total VSLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlayers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Plays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlays.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Play Rate: {avgPlayRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Duracao Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pitch Medio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgPitch)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ofertas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offerNames.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* UTMify per-offer summary from DB */}
      {utmifyOffers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gastos Total (UTMify)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.spend, 0), "USD")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Faturamento Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.revenue, 0), "USD")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Lucro Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.profit, 0), "USD")}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VTurb players grouped by offer */}
      {filteredStats.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Nenhum player com atividade no periodo selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedOffers.map(([offerName, players]) => {
          const offerViews = players.reduce((s, p) => s + p.viewed, 0);
          const offerPlays = players.reduce((s, p) => s + p.started, 0);
          const offerClicks = players.reduce((s, p) => s + p.clicked, 0);
          const offerPlayRate = offerViews > 0 ? Math.round((offerPlays / offerViews) * 10000) / 100 : 0;
          const utm = offerMetricsMap.get(offerName);

          return (
            <Card key={offerName}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>{offerName}</CardTitle>
                  <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                    <span>{offerPlays} plays</span>
                    <span>{offerViews} views</span>
                    <span>Play Rate: {offerPlayRate}%</span>
                    {utm && (
                      <>
                        <span className="text-red-500">Gasto: {formatCurrency(utm.spend, "USD")}</span>
                        <span className="text-emerald-600">Fatur: {formatCurrency(utm.revenue, "USD")}</span>
                        <span className={utm.profit >= 0 ? "text-emerald-600" : "text-red-500"}>
                          Lucro: {formatCurrency(utm.profit, "USD")}
                        </span>
                        {utm.costPerCheckout && (
                          <span className="text-blue-600">
                            Custo/Checkout: {formatCurrency(utm.costPerCheckout, "USD")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Plays</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead>Play Rate (%)</TableHead>
                        <TableHead>Retencao Pitch (%)</TableHead>
                        <TableHead className="text-right">Duracao</TableHead>
                        <TableHead className="text-right">Pitch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => (
                        <TableRow key={player.playerName}>
                          <TableCell className="font-medium max-w-[300px] truncate">{player.playerName}</TableCell>
                          <TableCell className="text-right">{player.viewed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{player.started.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{player.clicked.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-blue-500"
                                  style={{ width: `${Math.min(player.playRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm">{player.playRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(player.pitchRetention, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm">{player.pitchRetention}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatDuration(player.duration)}</TableCell>
                          <TableCell className="text-right text-sm">{formatDuration(player.pitchTime)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
