import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { parseMultiParam } from "@/lib/filter-utils";
import { getFilterOptions, getVslsForComparison } from "../actions";

function formatMinutes(val: number | null) {
  if (val == null) return "-";
  return `${val} min`;
}

export default async function VslComparisonPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters = {
    niches: parseMultiParam(params.niche),
    languages: parseMultiParam(params.language),
    copywriterIds: parseMultiParam(params.copy).map(Number).filter((n) => !isNaN(n)),
    statuses: parseMultiParam(params.status),
  };

  const hasFilters =
    (filters.niches.length > 0 ? filters : undefined) !== undefined;

  const [options, allVsls] = await Promise.all([
    getFilterOptions(),
    getVslsForComparison(
      filters.niches.length > 0 ||
      filters.languages.length > 0 ||
      filters.copywriterIds.length > 0 ||
      filters.statuses.length > 0
        ? filters
        : undefined
    ),
  ]);

  // Summary stats
  const totalVsls = allVsls.length;
  const durationsValid = allVsls.filter((v) => v.duration != null);
  const avgDuration =
    durationsValid.length > 0
      ? Math.round(durationsValid.reduce((s, v) => s + v.duration!, 0) / durationsValid.length)
      : null;
  const pitsValid = allVsls.filter((v) => v.priceRevealSecond != null);
  const avgPit =
    pitsValid.length > 0
      ? Math.round(pitsValid.reduce((s, v) => s + v.priceRevealSecond!, 0) / pitsValid.length)
      : null;

  // Group by project
  const grouped = allVsls.reduce((acc, vsl) => {
    const key = vsl.projectName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(vsl);
    return acc;
  }, {} as Record<string, typeof allVsls>);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Performance de VSLs</h1>
      <p className="text-muted-foreground">
        Analise a performance das VSLs por projeto, copywriter e metricas de pit de vendas.
      </p>

      <Suspense fallback={<div className="h-8" />}>
        <AnalyticsFilters
          options={{
            niches: options.niches,
            languages: options.languages,
            copywriters: options.copywriters,
            editors: options.editors,
            formats: [],
            statuses: options.niches.length > 0 ? ["escalou", "nao_escalou", "em_teste", "rodando", "pausado"] : [],
          }}
          showFormats={false}
          showEditors={false}
        />
      </Suspense>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total VSLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVsls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Duracao Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(avgDuration)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pit Medio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(avgPit)}</div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhuma VSL cadastrada ainda. Cadastre VSLs nos projetos para comparar.
        </p>
      ) : (
        Object.entries(grouped).map(([projectName, vsls]) => (
          <Card key={projectName}>
            <CardHeader>
              <CardTitle>{projectName}</CardTitle>
            </CardHeader>
            <CardContent>
              {vsls.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Apenas 1 VSL. Cadastre mais versoes para comparar.
                </p>
              ) : null}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versao</TableHead>
                      <TableHead>Copywriter</TableHead>
                      <TableHead>Duracao</TableHead>
                      <TableHead>Pit de Vendas (min)</TableHead>
                      <TableHead>Back Redirect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vsls.map((vsl) => (
                        <TableRow key={vsl.id}>
                          <TableCell className="font-bold">{vsl.version}</TableCell>
                          <TableCell>{vsl.copywriterName ?? "-"}</TableCell>
                          <TableCell>{formatMinutes(vsl.duration)}</TableCell>
                          <TableCell>{formatMinutes(vsl.priceRevealSecond)}</TableCell>
                          <TableCell>
                            <Badge variant={vsl.backRedirectActive ? "default" : "outline"}>
                              {vsl.backRedirectActive ? "Sim" : "Nao"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
