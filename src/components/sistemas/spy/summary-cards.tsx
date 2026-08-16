import { formatCount, formatTolerance } from "./format";
import type { SpyModuleEstadoData } from "./types";

export function SummaryCards({ data }: { data: SpyModuleEstadoData }) {
  const metrics = [
    { label: "Ofertas monitoradas", value: formatCount(data.ofertas.length) },
    { label: "Leituras registradas", value: formatCount(data.leituras.length) },
    { label: "Prontas pra modelar", value: formatCount(data.prontasParaModelar.length) },
    { label: "Tolerância de critério", value: formatTolerance(data.tolerancia) },
  ];

  return (
    <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do Spy Analytics">
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-h-24 p-4 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{metric.value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </section>
  );
}
