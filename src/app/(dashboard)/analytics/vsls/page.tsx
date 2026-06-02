import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { getDateRange } from "@/lib/date-utils";
import { OfferFilter } from "@/components/filters/offer-filter";
import { getVturbStats, getUtmifyOfferMetrics } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Video } from "lucide-react";

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
    <div className="space-y-8">
      <PageHeader
        title="Performance de VSLs"
        description="Métricas VTurb ao vivo por oferta — views, plays, play rate e retenção ao pitch."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Suspense fallback={<div className="h-8" />}>
          <DateRangeFilter />
        </Suspense>
        <Suspense fallback={<div className="h-8" />}>
          <OfferFilter offers={offerNames} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total VSLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{totalPlayers}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{totalPlays.toLocaleString()}</div>
            <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">Play Rate: {avgPlayRate}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duração Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{formatDuration(avgDuration)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pitch Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{formatDuration(avgPitch)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ofertas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{offerNames.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* UTMify per-offer summary from DB */}
      {utmifyOffers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-2 border-l-danger border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gasto Total (UTMify)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="tabular-nums text-2xl font-bold text-danger">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.spend, 0), "USD")}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-2 border-l-success border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Faturamento Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="tabular-nums text-2xl font-bold text-success">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.revenue, 0), "USD")}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-2 border-l-primary border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lucro Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="tabular-nums text-2xl font-bold">
                {formatCurrency(utmifyOffers.reduce((s, o) => s + o.profit, 0), "USD")}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VTurb players grouped by offer */}
      {filteredStats.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Nenhum player com atividade"
          description="Não há dados VTurb para o período selecionado. Tente outro intervalo ou remova o filtro de oferta."
        />
      ) : (
        sortedOffers.map(([offerName, players]) => {
          const offerViews = players.reduce((s, p) => s + p.viewed, 0);
          const offerPlays = players.reduce((s, p) => s + p.started, 0);
          const offerClicks = players.reduce((s, p) => s + p.clicked, 0);
          const offerPlayRate = offerViews > 0 ? Math.round((offerPlays / offerViews) * 10000) / 100 : 0;
          const utm = offerMetricsMap.get(offerName);

          return (
            <Card key={offerName} className="overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{offerName}</CardTitle>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium">{offerPlays.toLocaleString()} plays</span>
                    <span className="tabular-nums">{offerViews.toLocaleString()} views</span>
                    <span className="tabular-nums">Play Rate: <span className="text-foreground font-semibold">{offerPlayRate}%</span></span>
                    {utm && (
                      <>
                        <span className="tabular-nums text-danger">Gasto: {formatCurrency(utm.spend, "USD")}</span>
                        <span className="tabular-nums text-success">Fatur: {formatCurrency(utm.revenue, "USD")}</span>
                        <span className={`tabular-nums ${utm.profit >= 0 ? "text-success" : "text-danger"}`}>
                          Lucro: {formatCurrency(utm.profit, "USD")}
                        </span>
                        {utm.costPerCheckout && (
                          <span className="tabular-nums text-info">
                            Custo/Checkout: {formatCurrency(utm.costPerCheckout, "USD")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Player</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Views</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plays</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clicks</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Play Rate</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ret. Pitch</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duração</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pitch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, idx) => (
                      <TableRow
                        key={player.playerName}
                        className={idx % 2 === 1 ? "bg-muted/20" : ""}
                      >
                        <TableCell className="pl-4 font-medium max-w-[280px] truncate text-sm">{player.playerName}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{player.viewed.toLocaleString()}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{player.started.toLocaleString()}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{player.clicked.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-info transition-all"
                                style={{ width: `${Math.min(player.playRate, 100)}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-sm">{player.playRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-success transition-all"
                                style={{ width: `${Math.min(player.pitchRetention, 100)}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-sm">{player.pitchRetention}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">{formatDuration(player.duration)}</TableCell>
                        <TableCell className="tabular-nums pr-4 text-right text-sm">{formatDuration(player.pitchTime)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
