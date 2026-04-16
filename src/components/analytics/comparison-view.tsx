"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ComparisonData = {
  label: string;
  totalCreatives: number;
  totalVsls: number;
  pctEscalou: number;
  pctNaoEscalou: number;
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  roas: number | null;
  currency: string;
  hasCampaignData: boolean;
};

function formatCurrency(value: number, currency: string) {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

type ComparisonViewProps = {
  dataA: ComparisonData;
  dataB: ComparisonData;
};

// ---------------------------------------------------------------------------
// Internal: single side card
// ---------------------------------------------------------------------------
function ComparisonCard({
  data,
  highlightColor,
}: {
  data: ComparisonData;
  highlightColor: string;
}) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn("inline-block h-3 w-3 rounded-full", highlightColor)}
            aria-hidden
          />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Criativos" value={data.totalCreatives} />
          <Stat label="VSLs" value={data.totalVsls} />
        </div>

        <div className="space-y-2">
          <PctRow
            label="Escalou"
            value={data.pctEscalou}
            barColor="bg-emerald-500"
            isGood
          />
          <PctRow
            label="Nao Escalou"
            value={data.pctNaoEscalou}
            barColor="bg-red-400"
          />
        </div>

        {data.hasCampaignData && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Financeiro (UTMify)</p>
            <div className="grid grid-cols-2 gap-2">
              <MoneyStat label="Gasto" value={data.totalSpend} currency={data.currency} color="text-red-500" />
              <MoneyStat label="Faturamento" value={data.totalRevenue} currency={data.currency} color="text-emerald-600" />
              <MoneyStat
                label="Lucro"
                value={data.totalProfit}
                currency={data.currency}
                color={data.totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}
              />
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className="text-lg font-semibold">
                  {data.roas != null ? `${data.roas}x` : "-"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoneyStat({ label, value, currency, color }: { label: string; value: number; currency: string; color: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", color)}>
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function PctRow({
  label,
  value,
  barColor,
  isGood,
}: {
  label: string;
  value: number;
  barColor: string;
  isGood?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Badge
          variant={isGood && value >= 30 ? "default" : "secondary"}
          className={cn(
            "text-[10px]",
            isGood && value >= 30 && "bg-emerald-600 text-white"
          )}
        >
          {value.toFixed(1)}%
        </Badge>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison bar between the two datasets
// ---------------------------------------------------------------------------
function ComparisonBar({
  labelA,
  labelB,
  valueA,
  valueB,
  metric,
}: {
  labelA: string;
  labelB: string;
  valueA: number;
  valueB: number;
  metric: string;
}) {
  const total = valueA + valueB;
  const pctA = total > 0 ? (valueA / total) * 100 : 50;
  const pctB = total > 0 ? (valueB / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <p className="text-center text-xs font-medium text-muted-foreground">
        {metric}
      </p>
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        <div
          className="flex items-center justify-center bg-violet-500 text-[10px] font-semibold text-white transition-all"
          style={{ width: `${pctA}%` }}
        >
          {pctA >= 15 && `${valueA.toFixed(1)}%`}
        </div>
        <div
          className="flex items-center justify-center bg-amber-500 text-[10px] font-semibold text-white transition-all"
          style={{ width: `${pctB}%` }}
        >
          {pctB >= 15 && `${valueB.toFixed(1)}%`}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{labelA}</span>
        <span>{labelB}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ComparisonView({ dataA, dataB }: ComparisonViewProps) {
  return (
    <div className="space-y-4">
      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ComparisonCard data={dataA} highlightColor="bg-violet-500" />
        <ComparisonCard data={dataB} highlightColor="bg-amber-500" />
      </div>

      {/* Visual comparison bars */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ComparisonBar
            labelA={dataA.label}
            labelB={dataB.label}
            valueA={dataA.pctEscalou}
            valueB={dataB.pctEscalou}
            metric="% Escalou"
          />
          <ComparisonBar
            labelA={dataA.label}
            labelB={dataB.label}
            valueA={dataA.pctNaoEscalou}
            valueB={dataB.pctNaoEscalou}
            metric="% Nao Escalou"
          />
        </CardContent>
      </Card>
    </div>
  );
}
