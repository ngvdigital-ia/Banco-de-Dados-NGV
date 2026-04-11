import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/filters/analytics-filters";
import { parseMultiParam } from "@/lib/filter-utils";
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

  const [options, performance] = await Promise.all([
    getFilterOptions(),
    getTeamPerformance(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Performance da Equipe</h1>
      <p className="text-muted-foreground">
        Produtividade de cada membro: quantas VSLs, criativos e campanhas cada um produziu.
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
                    <TableHead className="text-center">VSLs (copy)</TableHead>
                    <TableHead className="text-center">Criativos (copy)</TableHead>
                    <TableHead className="text-center">Criativos (edicao)</TableHead>
                    <TableHead className="text-center">Campanhas</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Tarefas ClickUp (30d)</TableHead>
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
                        {member.vslCount > 0 ? member.vslCount : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.creativesCopyCount > 0 ? member.creativesCopyCount : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.creativesEditCount > 0 ? member.creativesEditCount : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.campaignCount > 0 ? member.campaignCount : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={member.totalOutput > 0 ? "default" : "secondary"}>
                          {member.totalOutput}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {member.clickupTasks > 0 ? (
                          <Badge variant="outline" className="border-purple-300 text-purple-700">
                            {member.clickupTasks}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
