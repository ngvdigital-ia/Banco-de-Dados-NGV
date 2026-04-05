import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters, parseMultiParam } from "@/components/filters/analytics-filters";
import { getFilterOptions, getOffersRanking } from "../actions";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
  escalou: "Escalou",
  nao_escalou: "Nao Escalou",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  em_teste: "outline",
  rodando: "default",
  pausado: "secondary",
  escalou: "default",
  nao_escalou: "destructive",
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

  const [options, offers] = await Promise.all([
    getFilterOptions(),
    getOffersRanking(hasAnyFilter ? filters : undefined),
  ]);

  const total = offers.length;
  const testing = offers.filter((o) => o.status === "em_teste").length;
  const running = offers.filter((o) => o.status === "rodando").length;
  const paused = offers.filter((o) => o.status === "pausado").length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ranking de Ofertas</h1>
      <p className="text-muted-foreground">
        Visao geral de todas as ofertas: quantas foram lancadas, quais estao rodando, quais escalaram.
      </p>

      <Suspense fallback={<div className="h-8" />}>
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
      </Suspense>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Lancadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testing}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((testing / total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rodando (Validadas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{running}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? Math.round((running / total) * 100) : 0}% taxa de validacao
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pausadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paused}</div>
          </CardContent>
        </Card>
      </div>

      {offers.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhuma oferta cadastrada.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todas as Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Nicho</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">VSLs</TableHead>
                    <TableHead className="text-center">Criativos</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead className="text-center">% Validacao</TableHead>
                    <TableHead>Lancado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => {
                    const pctValidacao = Number(offer.pctEscalou) || 0;
                    return (
                      <TableRow key={offer.id}>
                        <TableCell>
                          <Link
                            href={`/projects/${offer.id}`}
                            className="font-medium hover:underline"
                          >
                            {offer.name}
                          </Link>
                        </TableCell>
                        <TableCell>{offer.niche}</TableCell>
                        <TableCell>{offer.language}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[offer.status] ?? "outline"}>
                            {statusLabels[offer.status] ?? offer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{offer.vslCount}</TableCell>
                        <TableCell className="text-center">{offer.creativeCount}</TableCell>
                        <TableCell className="text-center">{offer.campaignCount}</TableCell>
                        <TableCell className="text-center">
                          {pctValidacao > 0 ? (
                            <Badge
                              variant="default"
                              className="bg-emerald-600 text-white"
                            >
                              {pctValidacao}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {offer.createdAt
                            ? new Date(offer.createdAt).toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
