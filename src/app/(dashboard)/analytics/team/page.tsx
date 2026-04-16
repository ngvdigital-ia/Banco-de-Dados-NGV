import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { parseMultiParam } from "@/lib/filter-utils";
import { getDateRange } from "@/lib/date-utils";
import { getFilterOptions, getTeamPerformance } from "../actions";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  copywriter: "Copywriter",
  editor: "Editor",
  gestor_trafego: "Gestor de Trafego",
};

export default async function TeamAnalyticsPage({
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

  const [options, performance] = await Promise.all([
    getFilterOptions(),
    getTeamPerformance(dateFrom, dateTo),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Performance da Equipe</h1>
      <p className="text-muted-foreground">
        Produtividade de cada membro: quantas VSLs, criativos e campanhas cada um produziu.
      </p>

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

      {performance.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhum membro ativo. Cadastre membros na aba Equipe.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Produtividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Funcao</TableHead>
                    <TableHead className="text-center">Copy</TableHead>
                    <TableHead className="text-center">Edicao</TableHead>
                    <TableHead className="text-center">Sites/Dev</TableHead>
                    <TableHead className="text-center">Trafego</TableHead>
                    <TableHead className="text-center">Outros</TableHead>
                    <TableHead className="text-center">Total (mes)</TableHead>
                    <TableHead className="text-center">% No Prazo</TableHead>
                    <TableHead className="text-center">% Escalou</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((member, i) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-bold text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[member.role] ?? member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {(member.clickupByCategory?.["Copy"] ?? 0) > 0
                          ? member.clickupByCategory["Copy"]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(member.clickupByCategory?.["Edição"] ?? 0) > 0
                          ? member.clickupByCategory["Edição"]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(member.clickupByCategory?.["Dev"] ?? 0) > 0
                          ? member.clickupByCategory["Dev"]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(member.clickupByCategory?.["Tráfego"] ?? 0) > 0
                          ? member.clickupByCategory["Tráfego"]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const cat = member.clickupByCategory ?? {};
                          const outros = Object.entries(cat)
                            .filter(([k]) => !["Copy", "Edição", "Dev", "Tráfego"].includes(k))
                            .reduce((sum, [, v]) => sum + v, 0);
                          return outros > 0 ? outros : "-";
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={member.clickupTasks > 0 ? "default" : "secondary"}>
                          {member.clickupTasks}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {member.clickupOnTimePct != null ? (
                          <Badge
                            variant="outline"
                            className={member.clickupOnTimePct >= 80
                              ? "border-emerald-300 text-emerald-700"
                              : member.clickupOnTimePct >= 50
                              ? "border-yellow-300 text-yellow-700"
                              : "border-red-300 text-red-700"}
                          >
                            {member.clickupOnTimePct}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.pctEscalou > 0 ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 text-white"
                          >
                            {member.pctEscalou}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
