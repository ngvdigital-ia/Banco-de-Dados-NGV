import Link from "next/link";
import {
  FolderOpen,
  Users,
  Video,
  Megaphone,
  BarChart3,
  ArrowRight,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardStats, getProjectsSummary, getMetricsTrend, getVturbSummary, getLatestUtmifySummary } from "./dashboard-actions";
import { SpendRevenueChart } from "@/components/charts/spend-revenue-chart";
import { RoasChart } from "@/components/charts/roas-chart";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  em_teste: "outline",
  rodando: "default",
  pausado: "secondary",
};

export default async function DashboardPage() {
  const [stats, recentProjects, metricsTrend, vturbSummary, utmifySummary] = await Promise.all([
    getDashboardStats(),
    getProjectsSummary(),
    getMetricsTrend(30),
    getVturbSummary(),
    getLatestUtmifySummary(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projetos
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProjects} rodando
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipe
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teamSize}</div>
            <p className="text-xs text-muted-foreground">membros ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VSLs
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVsls}</div>
            <p className="text-xs text-muted-foreground">cadastradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Criativos
            </CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCreatives}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campanhas
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">ativas</p>
          </CardContent>
        </Card>
        <Card className={utmifySummary ? "" : "bg-muted/50"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gasto / Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {utmifySummary ? (
              <>
                <div className="text-lg font-bold">
                  <span className="text-red-500">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: utmifySummary.currency }).format(utmifySummary.totalSpend / 100)}
                  </span>
                  {" / "}
                  <span className="text-emerald-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: utmifySummary.currency }).format(utmifySummary.totalRevenue / 100)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {utmifySummary.offersCount} ofertas rastreadas
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">-</div>
                <p className="text-xs text-muted-foreground">Sem dados UTMify</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* VTurb Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VTurb - Total Plays
            </CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vturbSummary.totalPlays.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {vturbSummary.totalViews.toLocaleString()} views totais
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VTurb - Play Rate Medio
            </CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vturbSummary.avgPlayRate}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min(vturbSummary.avgPlayRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VTurb - Retencao ao Pitch
            </CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vturbSummary.avgFinishRate}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.min(vturbSummary.avgFinishRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Projetos Recentes</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
              Ver todos <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum projeto cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nicho</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProjects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell>{p.niche}</TableCell>
                      <TableCell>{p.language}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status] ?? "outline"}>
                          {statusLabels[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gasto vs Receita (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsTrend.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Cadastre métricas para ver gráficos
                </p>
              </div>
            ) : (
              <SpendRevenueChart data={metricsTrend} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROAS (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsTrend.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Cadastre métricas para ver gráficos
                </p>
              </div>
            ) : (
              <RoasChart data={metricsTrend} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
