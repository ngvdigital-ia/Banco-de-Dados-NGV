import React from "react";
import { cn } from "@/lib/utils";

// Bloco shimmer base
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      style={style}
    />
  );
}

// Skeleton de KPI Card
function KpiCardSkeleton({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        accent && "border-t-2 border-t-primary"
      )}
    >
      {/* label */}
      <Shimmer className="h-3 w-20" />
      {/* número grande */}
      <Shimmer className="h-8 w-16" />
      {/* sub-texto */}
      <Shimmer className="h-3 w-28" />
    </div>
  );
}

// Skeleton do card de destaque Gasto/Receita (ocupa 2 colunas)
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

// Skeleton de card com progress bar (VTurb)
function ProgressCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Shimmer className="h-3 w-28" />
      <Shimmer className="h-8 w-14" />
      <Shimmer className="h-1.5 w-full rounded-full" />
    </div>
  );
}

// Skeleton da tabela de projetos
function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex gap-4 border-b pb-2">
        <Shimmer className="h-3 flex-1" />
        <Shimmer className="h-3 w-16" />
        <Shimmer className="h-3 w-12" />
        <Shimmer className="h-3 w-16" />
      </div>
      {/* Linhas */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-1">
          <Shimmer className="h-4 flex-1" />
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-4 w-10" />
          <Shimmer className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Skeleton de card com gráfico (área/barra)
function ChartCardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center border-b px-4 py-3">
        <Shimmer className="h-4 w-40" />
      </div>
      {/* Área do gráfico — barras falsas */}
      <div className="flex items-end gap-2 px-4 pt-4 pb-6 h-[300px]">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 h-full justify-end">
            <Shimmer
              className="w-full rounded-sm"
              style={{
                height: `${30 + ((i * 17 + 11) % 60)}%`,
                opacity: 0.6 + (i % 3) * 0.13,
              }}
            />
          </div>
        ))}
      </div>
      {/* Label acessível */}
      <span className="sr-only">Carregando {label}…</span>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8 pb-8" aria-busy="true" aria-label="Carregando dashboard">
      {/* ── Header ── */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-4 w-64" />
      </div>

      {/* ── Seção: Visão Geral ── */}
      <section>
        <Shimmer className="mb-3 h-3 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* Destaque Gasto/Receita */}
          <KpiHeroSkeleton />
          {/* 5 KPI cards */}
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton accent />
        </div>
      </section>

      {/* ── Seção: VTurb ── */}
      <section>
        <Shimmer className="mb-3 h-3 w-52" />
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCardSkeleton />
          <ProgressCardSkeleton />
          <ProgressCardSkeleton />
        </div>
      </section>

      {/* ── Seção: Projetos + Gráficos ── */}
      <section>
        <Shimmer className="mb-3 h-3 w-36" />
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tabela projetos */}
          <div className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-7 w-20 rounded-md" />
            </div>
            <div className="px-4 py-3">
              <TableSkeleton />
            </div>
          </div>

          {/* Gráfico Gasto vs Receita */}
          <ChartCardSkeleton label="Gasto vs Receita" />

          {/* Gráfico ROAS */}
          <ChartCardSkeleton label="ROAS" />
        </div>
      </section>
    </div>
  );
}
