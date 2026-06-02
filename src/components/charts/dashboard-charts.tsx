"use client";

/**
 * Wrapper lazy para os gráficos Recharts da home (/dashboard).
 *
 * Recharts (~404KB) NÃO deve entrar no First Load JS de todas as rotas.
 * Como page.tsx é Server Component (ssr:false é proibido lá — ver docs/01-app/02-guides/lazy-loading.md linha 94),
 * este Client Component usa next/dynamic com ssr:false para que o bundler
 * coloque Recharts em chunks separados carregados só no cliente e só nesta rota.
 */

import dynamic from "next/dynamic";

// Tipos locais — espelham as interfaces internas dos charts originais
interface SpendRevenueData {
  date: string;
  spend: number;
  revenue: number;
}

interface RoasData {
  date: string;
  roas: number;
}

// Skeleton inline — exibido enquanto o chunk de Recharts hidrata no cliente
function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
  );
}

const SpendRevenueChart = dynamic(
  () => import("./spend-revenue-chart").then((mod) => mod.SpendRevenueChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const RoasChart = dynamic(
  () => import("./roas-chart").then((mod) => mod.RoasChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export function LazySpendRevenueChart({ data }: { data: SpendRevenueData[] }) {
  return <SpendRevenueChart data={data} />;
}

export function LazyRoasChart({ data }: { data: RoasData[] }) {
  return <RoasChart data={data} />;
}
