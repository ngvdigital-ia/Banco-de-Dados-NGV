import { cn } from "@/lib/utils";
import { formatCount, formatPercent } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

function retentionTone(rate: number) {
  if (rate >= 70) return "text-success";
  if (rate >= 40) return "text-warning";
  return "text-danger";
}

function dropTone(rate: number) {
  if (rate >= 30) return "text-danger";
  if (rate >= 15) return "text-warning";
  return "text-success";
}

export function FunnelPanel({ funnel, campaigns }: { funnel: QuizModuleAnalyticsData["funnel"]; campaigns: QuizModuleAnalyticsData["utmCampaigns"] }) {
  const max = Math.max(1, funnel[0]?.count ?? 1);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Funil etapa por etapa</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quantas pessoas chegaram a cada etapa, retenção acumulada e queda comparada à etapa anterior.
          </p>
        </div>

        {funnel.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Ainda sem sessões nesse período.</p>
        ) : (
          <div className="divide-y">
            {funnel.map((step, index) => {
              const width = Math.max(0, Math.min(100, (step.count / max) * 100));
              return (
                <div key={step.id} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Etapa {index + 1} — {step.label}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums">{formatCount(step.count)}</span>
                  <span className={cn("text-xs font-medium", retentionTone(step.overallRate))}>
                    {formatPercent(step.overallRate)} <span className="font-normal text-muted-foreground">retenção total</span>
                  </span>
                  {index === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className={cn("text-xs font-medium", dropTone(step.prevDropRate))}>
                      ↓ {formatPercent(step.prevDropRate)}{" "}
                      <span className="font-normal text-muted-foreground">({formatCount(step.prevDropCount)} a menos)</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Campanhas UTM</h2>
        <p className="mt-1 text-xs text-muted-foreground">Sessões do período separadas por campanha.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {campaigns.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhuma campanha registrada nesse período.</span>
          ) : (
            campaigns.map((campaign) => (
              <span key={campaign.campaign} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs">
                {campaign.campaign} <b className="font-mono tabular-nums">{formatCount(campaign.sessions)}</b>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
