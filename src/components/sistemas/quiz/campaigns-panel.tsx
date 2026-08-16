import { formatCount } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

// Seção persistente, FORA das abas — igual ao original (index (1).html:97-100, section
// ".campaign-panel" solta depois dos ".tab-panel"): visível sob qualquer aba ativa, não
// só a de Funil. Extraído de funnel-panel.tsx onde tinha ficado preso por engano.
export function CampaignsPanel({ campaigns }: { campaigns: QuizModuleAnalyticsData["utmCampaigns"] }) {
  return (
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
  );
}
