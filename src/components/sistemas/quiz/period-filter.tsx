import Link from "next/link";
import { cn } from "@/lib/utils";
import { DEFAULT_PERIOD, PERIOD_PRESETS, type PeriodKey } from "./period";

export function PeriodFilter({ current }: { current: PeriodKey }) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Selecionar período">
      {PERIOD_PRESETS.map((preset) => {
        const isActive = preset.key === current;
        const href = preset.key === DEFAULT_PERIOD ? "/sistemas/quiz" : `/sistemas/quiz?period=${preset.key}`;
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
  );
}
