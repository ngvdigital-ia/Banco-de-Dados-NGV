"use client";

/**
 * Wrapper lazy para o gráfico de timeline de vendas.
 * Mesmo padrão de dashboard-charts.tsx: Recharts (~404KB) só carrega no cliente,
 * nesta rota, via next/dynamic ssr:false (proibido em Server Component).
 */

import dynamic from "next/dynamic";

interface VendasTimelineData {
  date: string;
  receita: number;
  vendas: number;
}

function ChartSkeleton() {
  return <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />;
}

const VendasTimelineChart = dynamic(
  () => import("./vendas-timeline-chart").then((mod) => mod.VendasTimelineChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function LazyVendasTimelineChart({
  data,
  currency,
}: {
  data: VendasTimelineData[];
  currency: string;
}) {
  return <VendasTimelineChart data={data} currency={currency} />;
}
