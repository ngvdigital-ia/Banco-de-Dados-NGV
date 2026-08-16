import { formatCount, formatPercent } from "./format";
import type { QuizModuleAnalyticsData } from "./types";

export function ResponsesPanel({ responses }: { responses: QuizModuleAnalyticsData["responses"] }) {
  if (responses.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Ainda sem respostas nesse período. Abra o quiz e faça uma sessão de teste.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {responses.map((question) => (
        <article key={question.id} className="rounded-lg border bg-card p-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {/* `!== null` e não truthy: o schema aceita stage_number 0 como etapa
                legítima, e `0 ?` cairia no ramo de "etapa desconhecida". */}
            {question.stageNumber !== null ? `Etapa ${question.stageNumber} — ${question.stageLabel}` : `Etapa — ${question.stageLabel}`}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{question.label}</h3>
            <span className="text-xs text-muted-foreground">
              <b className="font-mono tabular-nums text-foreground">{formatCount(question.totalSessions)}</b> leads responderam
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {question.answers.map((answer) => (
              <div key={answer.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate" title={answer.label}>
                    {answer.label}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, answer.pct)}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs">
                  <b className="font-mono tabular-nums text-foreground">{formatPercent(answer.pct)}</b>
                  <p className="text-muted-foreground">{formatCount(answer.count)}</p>
                </div>
              </div>
            ))}
          </div>

          {question.multi && (
            <p className="mt-3 text-xs text-muted-foreground">
              Múltipla escolha — cada percentual representa a parcela dos leads que marcou aquela opção.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
