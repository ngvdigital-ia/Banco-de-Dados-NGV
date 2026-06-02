import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { parseMultiParam } from "@/lib/filter-utils";
import { getDateRange } from "@/lib/date-utils";
import { getFilterOptions, getTeamPerformance } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  copywriter: "Copywriter",
  editor: "Editor",
  gestor_trafego: "Gestor de Tráfego",
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
    <div className="space-y-8">
      <PageHeader
        title="Performance da Equipe"
        description="Produtividade de cada membro: quantas VSLs, criativos e campanhas cada um produziu."
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

      {performance.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro ativo"
          description="Cadastre membros na aba Equipe para acompanhar a produtividade aqui."
          action={{ label: "Ir para Equipe", href: "/team" }}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">Ranking de Produtividade</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 w-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Função</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Copy</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edição</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sites/Dev</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tráfego</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outros</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total (mês)</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">% No Prazo</TableHead>
                  <TableHead className="pr-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">% Escalou</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performance.map((member, i) => (
                  <TableRow key={member.id} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell className="pl-4 tabular-nums font-bold text-muted-foreground text-sm">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{member.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {roleLabels[member.role] ?? member.role}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {(member.clickupByCategory?.["Copy"] ?? 0) > 0
                        ? member.clickupByCategory["Copy"]
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {(member.clickupByCategory?.["Edição"] ?? 0) > 0
                        ? member.clickupByCategory["Edição"]
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {(member.clickupByCategory?.["Dev"] ?? 0) > 0
                        ? member.clickupByCategory["Dev"]
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {(member.clickupByCategory?.["Tráfego"] ?? 0) > 0
                        ? member.clickupByCategory["Tráfego"]
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {(() => {
                        const cat = member.clickupByCategory ?? {};
                        const outros = Object.entries(cat)
                          .filter(([k]) => !["Copy", "Edição", "Dev", "Tráfego"].includes(k))
                          .reduce((sum, [, v]) => sum + v, 0);
                        return outros > 0 ? outros : <span className="text-muted-foreground/50">—</span>;
                      })()}
                    </TableCell>
                    <TableCell className="tabular-nums text-center">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${member.clickupTasks > 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                        {member.clickupTasks}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-center">
                      {member.clickupOnTimePct != null ? (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          member.clickupOnTimePct >= 80
                            ? "border-success bg-success-muted text-success-muted-foreground"
                            : member.clickupOnTimePct >= 50
                            ? "border-warning bg-warning-muted text-warning-muted-foreground"
                            : "border-danger bg-danger-muted text-danger-muted-foreground"
                        }`}>
                          {member.clickupOnTimePct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums pr-4 text-center">
                      {member.pctEscalou > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-success bg-success-muted px-2 py-0.5 text-xs font-medium text-success-muted-foreground">
                          {member.pctEscalou}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
