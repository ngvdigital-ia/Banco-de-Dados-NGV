"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const periods = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
  { label: "Este mês", value: "month" },
  { label: "Tudo", value: "all" },
] as const;

export type PeriodValue = (typeof periods)[number]["value"];

/**
 * Utility to compute { from, to } based on a period string.
 * Can be used in server actions / server components.
 */
export function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { from, to };
    }
    case "7d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "15d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 14);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "30d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to };
    }
    case "all":
    default:
      return { from: new Date(2020, 0, 1), to };
  }
}

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
