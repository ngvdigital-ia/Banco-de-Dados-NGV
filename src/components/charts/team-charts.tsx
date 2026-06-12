"use client";

/**
 * Wrapper lazy para o gráfico de equipe (team-monthly-chart).
 *
 * Recharts (~404KB) não deve entrar no First Load JS de todas as rotas.
 * Este Client Component usa next/dynamic com ssr:false para que o bundler
 * coloque Recharts em chunks separados carregados só no cliente e só nesta rota.
 */

import dynamic from "next/dynamic";
import type { TeamMonthlyChartProps } from "./team-monthly-chart";

// Skeleton inline — exibido enquanto o chunk de Recharts hidrata no cliente
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
  );
}

const TeamMonthlyChart = dynamic(
  () =>
    import("./team-monthly-chart").then((mod) => mod.TeamMonthlyChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function LazyTeamMonthlyChart(props: TeamMonthlyChartProps) {
  return <TeamMonthlyChart {...props} />;
}
