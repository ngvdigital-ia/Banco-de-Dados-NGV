import { formatCount, formatPercent } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

export function SummaryCards({ summary }: { summary: QuizModuleAnalyticsData["summary"] }) {
  const metrics = [
    { label: "Sessões no período", value: formatCount(summary.totalSessions) },
    { label: "Chegaram à etapa 1", value: formatCount(summary.started) },
    { label: "Cliques no checkout", value: formatCount(summary.checkoutClicks) },
    { label: "Retenção etapa 1 → checkout", value: formatPercent(summary.checkoutRate) },
  ];

  return (
    <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do Quiz">
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-h-24 p-4 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{metric.value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </section>
  );
}
