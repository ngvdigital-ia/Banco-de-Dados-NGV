import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { parseMultiParam } from "@/lib/filter-utils";
import { getFilterOptions, getCreativesByFormat } from "../actions";

const formatLabels: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masculino",
  ugc_fem: "UGC Feminino",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
  sem_formato: "Sem Formato",
};

const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  tiktok: "TikTok",
  google: "Google",
  kwai: "Kwai",
};

export default async function CreativesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters = {
    niches: parseMultiParam(params.niche),
    languages: parseMultiParam(params.language),
    copywriterIds: parseMultiParam(params.copy).map(Number).filter((n) => !isNaN(n)),
    editorIds: parseMultiParam(params.editor).map(Number).filter((n) => !isNaN(n)),
    formats: parseMultiParam(params.format),
    statuses: parseMultiParam(params.status),
  };

  const hasAnyFilter =
    filters.niches.length > 0 ||
    filters.languages.length > 0 ||
    filters.copywriterIds.length > 0 ||
    filters.editorIds.length > 0 ||
    filters.formats.length > 0 ||
    filters.statuses.length > 0;

  const creativeFilters = {
    language: filters.languages.length > 0 ? filters.languages[0] : undefined,
    format: filters.formats.length > 0 ? filters.formats[0] : undefined,
    validation: filters.statuses.length > 0 ? filters.statuses[0] : undefined,
  };

  const [options, byFormat] = await Promise.all([
    getFilterOptions(),
    getCreativesByFormat(creativeFilters),
  ]);

  const totalCreatives = byFormat.reduce((sum, f) => sum + Number(f.count), 0);
  const totalEscalou = byFormat.reduce((sum, f) => sum + Number(f.countEscalou), 0);
  const totalValidou = byFormat.reduce((sum, f) => sum + Number(f.countValidou), 0);

  const pctEscalouGlobal = totalCreatives > 0 ? Math.round((totalEscalou / totalCreatives) * 10000) / 100 : 0;
  const pctValidouGlobal = totalCreatives > 0 ? Math.round((totalValidou / totalCreatives) * 10000) / 100 : 0;

  // Group by format (aggregate across platforms) with conversion metrics
  const formatAgg: Record<string, {
    total: number;
    escalou: number;
    validou: number;
    naoValidou: number;
  }> = {};

  for (const row of byFormat) {
    const fmt = row.format ?? "sem_formato";
    if (!formatAgg[fmt]) {
      formatAgg[fmt] = { total: 0, escalou: 0, validou: 0, naoValidou: 0 };
    }
    formatAgg[fmt].total += Number(row.count);
    formatAgg[fmt].escalou += Number(row.countEscalou);
    formatAgg[fmt].validou += Number(row.countValidou);
    formatAgg[fmt].naoValidou += Number(row.countNaoValidou);
  }

  const sortedFormats = Object.entries(formatAgg).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analise de Criativos</h1>
      <p className="text-muted-foreground">
        Veja quais formatos de criativo estao sendo mais usados e suas metricas de conversao.
      </p>

      <Suspense fallback={<div className="h-8" />}>
        <AnalyticsFilters
          options={{
            niches: options.niches,
            languages: options.languages,
            copywriters: options.copywriters,
            editors: options.editors,
            formats: options.formats,
            statuses: ["rascunho", "validou", "nao_validou", "escalou", "nao_escalou"],
          }}
          showFormats={true}
        />
      </Suspense>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Criativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreatives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% Escalou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{pctEscalouGlobal}%</div>
            <p className="text-xs text-muted-foreground">{totalEscalou} criativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">% Validou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pctValidouGlobal}%</div>
            <p className="text-xs text-muted-foreground">{totalValidou} criativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion metrics by format */}
      <Card>
        <CardHeader>
          <CardTitle>Metricas de Conversao por Formato</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedFormats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum criativo cadastrado
            </p>
          ) : (
            <div className="space-y-5">
              {sortedFormats.map(([format, stats]) => {
                const pctEscalou = stats.total > 0 ? Math.round((stats.escalou / stats.total) * 10000) / 100 : 0;
                const pctValidou = stats.total > 0 ? Math.round((stats.validou / stats.total) * 10000) / 100 : 0;
                const pctNaoValidou = stats.total > 0 ? Math.round((stats.naoValidou / stats.total) * 10000) / 100 : 0;
                return (
                  <div key={format} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatLabels[format] ?? format}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {stats.total} criativos
                      </span>
                    </div>

                    {/* Escalou bar - green */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Escalou</span>
                        <span className="font-medium text-emerald-600">{pctEscalou}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(pctEscalou, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Validou bar - yellow */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Validou</span>
                        <span className="font-medium text-yellow-600">{pctValidou}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-yellow-500 transition-all"
                          style={{ width: `${Math.min(pctValidou, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Nao validou bar - red */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Nao validou</span>
                        <span className="font-medium text-red-500">{pctNaoValidou}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400 transition-all"
                          style={{ width: `${Math.min(pctNaoValidou, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format detail table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Formato</CardTitle>
        </CardHeader>
        <CardContent>
          {byFormat.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Defina o formato das ofertas na tabela de Ofertas para ver dados aqui.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formato</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">% Escalou</TableHead>
                    <TableHead className="text-right">% Validou</TableHead>
                    <TableHead className="text-right">% Nao Validou</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFormat.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline">
                          {formatLabels[row.format ?? ""] ?? row.format ?? "Sem formato"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.count}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {Number(row.pctEscalou) || 0}%
                      </TableCell>
                      <TableCell className="text-right text-yellow-600">
                        {Number(row.pctValidou) || 0}%
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        {Number(row.pctNaoValidou) || 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
