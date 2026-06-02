import { Suspense } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Users,
  Video,
  Megaphone,
  BarChart3,
  ArrowRight,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LazySpendRevenueChart, LazyRoasChart } from "@/components/charts/dashboard-charts";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

const statusVariant: Record<string, "warning" | "success" | "neutral"> = {
  em_teste: "warning",
  rodando: "success",
  pausado: "neutral",
};

// ── Skeletons inline (reutilizados do loading.tsx) ──────────────────────────

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={style}
    />
  );
}

function KpiCardSkeleton({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        accent && "border-t-2 border-t-primary"
      )}
    >
      <Shimmer className="h-3 w-20" />
      <Shimmer className="h-8 w-16" />
      <Shimmer className="h-3 w-28" />
    </div>
  );
}

function ProgressCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Shimmer className="h-3 w-28" />
      <Shimmer className="h-8 w-14" />
      <Shimmer className="h-1.5 w-full rounded-full" />
    </div>
  );
}

function KpiHeroSkeleton() {
  return (
    <div className="col-span-full sm:col-span-2 md:col-span-3 xl:col-span-2 flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 border-t-2 border-t-primary">
      <Shimmer className="h-3 w-36" />
      <div className="flex items-baseline gap-3">
        <Shimmer className="h-9 w-28" />
        <Shimmer className="h-5 w-3" />
        <Shimmer className="h-9 w-28" />
      </div>
      <Shimmer className="h-3 w-32" />
    </div>
  );
}

// Skeleton da seção VTurb completa (3 cards)
function VturbSectionSkeleton() {
  return (
    <section>
      <Shimmer className="mb-3 h-3 w-52" />
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCardSkeleton />
        <ProgressCardSkeleton />
        <ProgressCardSkeleton />
      </div>
    </section>
  );
}

// Skeleton do card UTMify (hero card)
function UtmifySkeleton() {
  return <KpiHeroSkeleton />;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ElementType;
  accent?: boolean;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-shadow duration-200 hover:shadow-md",
        accent && "border-t-2 border-t-primary"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground leading-none">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              accent ? "text-primary" : "text-muted-foreground"
            )}
          />
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="tabular-nums text-3xl font-bold leading-none tracking-tight">
          {value}
        </div>
        {sub && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-success" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-danger" />}
            {trend === "neutral" && <Minus className="h-3 w-3 text-muted-foreground" />}
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Async Server Components isolados para VTurb e UTMify ─────────────────────

// Renderiza o card hero de Gasto/Receita (UTMify) — query DB rápida, mas
// isolada em Suspense para não bloquear o resto da grid caso haja lentidão.
async function UtmifyCard() {
  const utmifySummary = await getLatestUtmifySummary();
  return (
    <Card
      className={cn(
        "relative overflow-hidden col-span-full sm:col-span-2 md:col-span-3 xl:col-span-2",
        "border-t-2 border-t-primary transition-shadow duration-200 hover:shadow-md",
        !utmifySummary && "opacity-60"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Gasto / Receita (UTMify)
        </span>
        <BarChart3 className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        {utmifySummary ? (
          <>
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-3xl font-bold text-danger leading-none tracking-tight">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: utmifySummary.currency }).format(utmifySummary.totalSpend / 100)}
              </span>
              <span className="text-muted-foreground text-lg font-medium">/</span>
              <span className="text-3xl font-bold text-success leading-none tracking-tight">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: utmifySummary.currency }).format(utmifySummary.totalRevenue / 100)}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {utmifySummary.offersCount} ofertas rastreadas
            </p>
          </>
        ) : (
          <>
            <div className="text-3xl font-bold text-muted-foreground leading-none">-</div>
            <p className="mt-1.5 text-xs text-muted-foreground">Sem dados UTMify</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Renderiza a seção completa de VTurb — resultado cacheado via unstable_cache em getVturbSummary.
// Streama depois dos KPIs de DB (que renderizam imediato).
async function VturbSection() {
  const vturbSummary = await getVturbSummary();
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Performance de Vídeo (VTurb — 30 dias)
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Total de Plays"
          value={vturbSummary.totalPlays.toLocaleString("pt-BR")}
          sub={`${vturbSummary.totalViews.toLocaleString("pt-BR")} views totais`}
          icon={Play}
        />

        {/* Play Rate com progress bar */}
        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Play Rate Médio
            </span>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className="tabular-nums text-3xl font-bold leading-none tracking-tight">
              {vturbSummary.avgPlayRate}%
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-info transition-all duration-500"
                style={{ width: `${Math.min(vturbSummary.avgPlayRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Retenção ao Pitch com progress bar */}
        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Retenção ao Pitch
            </span>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            {vturbSummary.avgPitchRetention != null ? (
              <>
                <div className="tabular-nums text-3xl font-bold leading-none tracking-tight">
                  {vturbSummary.avgPitchRetention}%
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-success transition-all duration-500"
                    style={{ width: `${Math.min(vturbSummary.avgPitchRetention, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-muted-foreground leading-none">-</div>
                <p className="mt-1.5 text-xs text-muted-foreground">Sem dados recentes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ── Page principal ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // KPIs de DB: renderizam imediato (sem VTurb/UTMify no critical path)
  const [stats, recentProjects, metricsTrend] = await Promise.all([
    getDashboardStats(),
    getProjectsSummary(),
    getMetricsTrend(30),
  ]);

  const activeFraction = stats.totalProjects > 0
    ? stats.activeProjects / stats.totalProjects
    : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da operação NGV Digital
        </p>
      </div>

      {/* ── KPI Principal: Gasto / Receita (UTMify) + 5 contadores de DB ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Visão Geral
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* Card UTMify streama separado — skeleton enquanto carrega */}
          <Suspense fallback={<UtmifySkeleton />}>
            <UtmifyCard />
          </Suspense>

          {/* KPIs de DB renderizam imediato */}
          <KpiCard
            label="Ofertas"
            value={stats.totalProjects}
            sub={`${stats.activeProjects} em andamento`}
            icon={FolderOpen}
            trend={activeFraction >= 0.5 ? "up" : "neutral"}
          />
          <KpiCard
            label="Equipe"
            value={stats.teamSize}
            sub="membros ativos"
            icon={Users}
          />
          <KpiCard
            label="VSLs"
            value={stats.totalVsls}
            sub="com copy pronta"
            icon={Video}
          />
          <KpiCard
            label="Ads Editados"
            value={stats.totalCreatives}
            sub="total"
            icon={Megaphone}
          />
          <KpiCard
            label="Campanhas"
            value={stats.totalCampaigns}
            sub="ofertas ativas"
            icon={BarChart3}
            accent
            trend={stats.totalCampaigns > 0 ? "up" : "neutral"}
          />
        </div>
      </section>

      {/* ── VTurb streama depois — skeleton enquanto ~11 chamadas HTTP resolvem ── */}
      <Suspense fallback={<VturbSectionSkeleton />}>
        <VturbSection />
      </Suspense>

      {/* ── Tabela + Gráficos (dados de DB — renderizam imediato) ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Projetos &amp; Métricas
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <CardTitle>Projetos Recentes</CardTitle>
              <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              {recentProjects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
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
                      <TableRow
                        key={p.id}
                        className="transition-colors duration-150 hover:bg-accent/50"
                      >
                        <TableCell>
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-medium hover:text-primary transition-colors duration-150 hover:underline"
                          >
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>{p.niche}</TableCell>
                        <TableCell>{p.language}</TableCell>
                        <TableCell>
                          <StatusBadge variant={statusVariant[p.status] ?? "neutral"}>
                            {statusLabels[p.status] ?? p.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="border-b pb-3">
              <CardTitle>Gasto vs Receita (30 dias)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {metricsTrend.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Cadastre métricas para ver gráficos
                  </p>
                </div>
              ) : (
                <LazySpendRevenueChart data={metricsTrend} />
              )}
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="border-b pb-3">
              <CardTitle>ROAS (30 dias)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {metricsTrend.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Cadastre métricas para ver gráficos
                  </p>
                </div>
              ) : (
                <LazyRoasChart data={metricsTrend} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
