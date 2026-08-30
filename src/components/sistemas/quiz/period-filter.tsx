import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildQuizPeriodHref } from "./funnel";
import { PERIOD_PRESETS, toDateInputValue, type PeriodKey } from "./period";

const dateInputClass = cn(
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none transition-colors",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
);

// Server Component puro (sem "use client") — igual às outras 6 opções de período,
// a navegação é por link/form GET, nunca fetch no cliente. O bloco De/Até só some
// quando o preset ativo não é "custom" (mesma revelação progressiva do original em
// dashboard.js:selectPeriod(), só que decidida no servidor pela URL em vez de um
// toggle de classe no DOM).
export function PeriodFilter({
  current,
  customFrom,
  customTo,
  funnelId,
}: {
  current: PeriodKey;
  customFrom?: string;
  customTo?: string;
  funnelId: string;
}) {
  const today = toDateInputValue(new Date());

  return (
    <div className="flex flex-wrap items-end gap-3">
      <nav className="flex flex-wrap gap-1.5" aria-label="Selecionar período">
        {PERIOD_PRESETS.map((preset) => {
          const isActive = preset.key === current;
          const href = buildQuizPeriodHref(preset.key, funnelId);
          return (
            <Link
              key={preset.key}
              href={href}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>

      {current === "custom" ? (
        <form method="get" action="/sistemas/quiz" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          <input type="hidden" name="funnel" value={funnelId} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            De
            <input type="date" name="from" defaultValue={customFrom ?? today} className={dateInputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Até
            <input type="date" name="to" defaultValue={customTo ?? today} className={dateInputClass} />
          </label>
          <button
            type="submit"
            className="h-8 rounded-md border border-primary bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Aplicar
          </button>
        </form>
      ) : null}
    </div>
  );
}
