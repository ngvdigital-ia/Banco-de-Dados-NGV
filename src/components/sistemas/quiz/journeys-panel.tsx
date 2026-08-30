import { formatCount } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

export function JourneysPanel({ journeys }: { journeys: QuizModuleAnalyticsData["journeys"] }) {
  const max = Math.max(1, ...journeys.pages.map((page) => page.count));

  return (
    <div className="space-y-4">
      <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2" aria-label="Indicadores de jornada">
        <div className="min-h-24 p-4">
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{formatCount(journeys.summary.totalJourneys)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Jornadas no período</p>
        </div>
        <div className="min-h-24 border-t p-4 sm:border-t-0 sm:border-l">
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{formatCount(journeys.summary.crossPageJourneys)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Multi-página (mais de uma página)</p>
        </div>
      </section>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Tráfego por página</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quantas jornadas anônimas chegaram à presell, VSL e demais páginas deste funil.
          </p>
        </div>
        {journeys.pages.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Ainda não há jornadas nesse período.</p>
        ) : (
          <div className="divide-y">
            {journeys.pages.map((page) => {
              const width = Math.max(0, Math.min(100, (page.count / max) * 100));
              return (
                <div key={page.pageId} className="grid grid-cols-[1fr_auto] items-center gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{page.pageId}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums">{formatCount(page.count)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
