import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { parseMultiParam } from "@/lib/filter-utils";
import { getDateRange } from "@/lib/date-utils";
import { getFilterOptions, getOffersRanking, getOfferProductionTimeline } from "../actions";
import { ProductionTimeline } from "@/components/analytics/production-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy } from "lucide-react";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
  escalou: "Escalou",
  nao_escalou: "Não Escalou",
};

const statusClasses: Record<string, string> = {
  escalou: "bg-success-muted text-success-muted-foreground border-success",
  rodando: "bg-info-muted text-info-muted-foreground border-info",
  em_teste: "bg-warning-muted text-warning-muted-foreground border-warning",
  pausado: "border-border text-muted-foreground",
  nao_escalou: "bg-danger-muted text-danger-muted-foreground border-danger",
};

export default async function OffersRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters = {
    niches: parseMultiParam(params.niche),
    languages: parseMultiParam(params.language),
    statuses: parseMultiParam(params.status),
  };

  const hasAnyFilter =
    filters.niches.length > 0 ||
    filters.languages.length > 0 ||
    filters.statuses.length > 0;

  const period = typeof params.period === "string" ? params.period : "all";
  const { from, to } = getDateRange(period);
  const dateFrom = period === "all" ? undefined : from.toISOString();
  const dateTo = period === "all" ? undefined : to.toISOString();

  const [options, offers, productionData] = await Promise.all([
    getFilterOptions(),
    getOffersRanking(hasAnyFilter ? filters : undefined, dateFrom, dateTo),
    getOfferProductionTimeline(),
  ]);

  const total = offers.length;
  const testing = offers.filter((o) => o.status === "em_teste").length;
  const running = offers.filter((o) => o.status === "rodando").length;
  const paused = offers.filter((o) => o.status === "pausado").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ranking de Ofertas"
        description="Visão geral de todas as ofertas: quantas foram lançadas, quais estão rodando, quais escalaram."
      />

      <Suspense fallback={<div className="h-8" />}>
        <div className="space-y-3">
          <DateRangeFilter />
          <AnalyticsFilters
            options={{
              niches: options.niches,
              languages: options.languages,
              copywriters: options.copywriters,
              editors: options.editors,
              formats: [],
              statuses: ["escalou", "nao_escalou", "em_teste", "rodando", "pausado"],
            }}
            showFormats={false}
            showEditors={false}
          />
        </div>
      </Suspense>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Lançadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-warning border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Em Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{testing}</div>
            <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">
              {total > 0 ? Math.round((testing / total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-2 border-l-success border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rodando (Validadas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold text-success">{running}</div>
            <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">
              {total > 0 ? Math.round((running / total) * 100) : 0}% taxa de validação
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pausadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tabular-nums text-2xl font-bold">{paused}</div>
          </CardContent>
        </Card>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nenhuma oferta cadastrada"
          description="Cadastre ofertas em Projetos para acompanhá-las aqui."
          action={{ label: "Ir para Projetos", href: "/projects" }}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Todas as Ofertas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projeto</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nicho</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Idioma</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">VSLs</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Criativos</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campanhas</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">% Validação</TableHead>
                  <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lançado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer, idx) => {
                  const pctValidacao = Number(offer.pctEscalou) || 0;
                  return (
                    <TableRow
                      key={offer.id}
                      className={idx % 2 === 1 ? "bg-muted/20" : ""}
                    >
                      <TableCell className="pl-4">
                        <Link
                          href={`/projects/${offer.id}`}
                          className="font-medium text-sm hover:text-primary transition-colors"
                        >
                          {offer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{offer.niche}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{offer.language}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusClasses[offer.status] ?? "border-border text-muted-foreground"}`}>
                          {statusLabels[offer.status] ?? offer.status}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{offer.vslCount}</TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{offer.creativeCount}</TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{offer.campaignCount}</TableCell>
                      <TableCell className="text-center">
                        {pctValidacao > 0 ? (
                          <span className="tabular-nums inline-flex items-center rounded-md border border-success bg-success-muted px-2 py-0.5 text-xs font-medium text-success-muted-foreground">
                            {pctValidacao}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums pr-4 text-sm text-muted-foreground">
                        {offer.createdAt
                          ? new Date(offer.createdAt).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {productionData.offers.length > 0 && (
        <ProductionTimeline offers={productionData.offers} />
      )}
    </div>
  );
}
