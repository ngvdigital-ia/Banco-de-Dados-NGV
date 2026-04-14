"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Re-export for backward compat
export { getDateRange } from "@/lib/date-utils";

const periods = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
  { label: "Este mês", value: "month" },
  { label: "Tudo", value: "all" },
] as const;

export type PeriodValue = (typeof periods)[number]["value"];

export function DateRangeFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const current = searchParams.get("period") ?? "all";

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("period");
    } else {
      params.set("period", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      {periods.map((p) => (
        <Button
          key={p.value}
          variant={current === p.value ? "default" : "outline"}
          size="sm"
          className={cn("text-xs")}
          onClick={() => handleSelect(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
