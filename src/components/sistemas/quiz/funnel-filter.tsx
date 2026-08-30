import { Filter } from "lucide-react";
import type { PeriodKey } from "./period";

export function FunnelFilter({
  activeFunnel,
  period,
  customFrom,
  customTo,
  invalidRequested,
}: {
  activeFunnel: string;
  period: PeriodKey;
  customFrom?: string;
  customTo?: string;
  invalidRequested?: boolean;
}) {
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="quiz-funnel-filter-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p id="quiz-funnel-filter-title" className="text-sm font-semibold">
            Funil acompanhado
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Presell, VSL e demais páginas são lidas somente para o identificador selecionado.
          </p>
        </div>

        <form method="get" action="/sistemas/quiz" className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          {period !== "today" ? <input type="hidden" name="period" value={period} /> : null}
          {period === "custom" ? (
            <>
              <input type="hidden" name="from" value={customFrom ?? ""} />
              <input type="hidden" name="to" value={customTo ?? ""} />
            </>
          ) : null}
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-64">
            Identificador do funil
            <input
              name="funnel"
              type="text"
              list="quiz-funnel-options"
              defaultValue={activeFunnel}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={120}
              autoComplete="off"
              aria-invalid={invalidRequested || undefined}
              aria-describedby={invalidRequested ? "quiz-funnel-filter-error" : undefined}
              className="h-11 rounded-md border border-input bg-transparent px-3 font-mono text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 dark:bg-input/30"
            />
            <datalist id="quiz-funnel-options">
              <option value="roxyfox">RoxyFox</option>
            </datalist>
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
          >
            <Filter className="size-4" aria-hidden="true" />
            Ver funil
          </button>
        </form>
      </div>
      {invalidRequested ? (
        <p id="quiz-funnel-filter-error" className="mt-3 text-xs text-danger" role="alert">
          Identificador inválido — exibindo RoxyFox. Use letras minúsculas, números e hífens.
        </p>
      ) : null}
    </section>
  );
}
