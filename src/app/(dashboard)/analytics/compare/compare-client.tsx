"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComparisonView, type ComparisonData } from "@/components/analytics/comparison-view";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { getDateRange } from "@/lib/date-utils";
import { getComparisonData, type getFilterOptions } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftRight } from "lucide-react";

type Dimension = "niche" | "language" | "copywriter" | "editor";

type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

const dimensionLabels: Record<Dimension, string> = {
  niche: "Oferta",
  language: "Idioma",
  copywriter: "Copywriter",
  editor: "Editor",
};

interface ComparePageClientProps {
  filterOptions: FilterOptions;
}

function ComparePageInner({ filterOptions }: ComparePageClientProps) {
  const searchParams = useSearchParams();
  const [dimension, setDimension] = useState<Dimension | null>(null);
  const [valueA, setValueA] = useState<string | null>(null);
  const [valueB, setValueB] = useState<string | null>(null);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<[ComparisonData, ComparisonData] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  function handleDimensionChange(val: string | null) {
    if (!val) return;
    const dim = val as Dimension;
    setDimension(dim);
    setValueA(null);
    setValueB(null);
    setResult(null);
    setOptionsLoaded(false);

    // Deriva opções diretamente do filterOptions já carregado no servidor — sem round-trip
    startTransition(() => {
      let items: { value: string; label: string }[] = [];

      switch (dim) {
        case "niche":
          items = filterOptions.niches.map((n) => ({ value: n, label: n }));
          break;
        case "language":
          items = filterOptions.languages.map((l) => ({ value: l, label: l }));
          break;
        case "copywriter":
          items = filterOptions.copywriters.map((c) => ({
            value: String(c.id),
            label: c.name,
          }));
          break;
        case "editor":
          items = filterOptions.editors.map((e) => ({
            value: String(e.id),
            label: e.name,
          }));
          break;
      }

      setOptions(items);
      setOptionsLoaded(true);
    });
  }

  function handleCompare() {
    if (!dimension || !valueA || !valueB) return;

    const period = searchParams.get("period") ?? "all";
    const { from, to } = getDateRange(period);
    const dateFrom = period === "all" ? undefined : from.toISOString();
    const dateTo = period === "all" ? undefined : to.toISOString();

    startTransition(async () => {
      const data = await getComparisonData(
        dimension,
        [valueA, valueB],
        dateFrom,
        dateTo,
      );
      if (data.length === 2) {
        setResult([data[0], data[1]]);
      }
    });
  }

  const canCompare = dimension && valueA && valueB && valueA !== valueB;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comparar"
        description="Compare métricas entre nichos, idiomas, copywriters ou editores lado a lado."
      />

      <p className="text-xs text-muted-foreground -mt-4">
        Período &quot;Tudo&quot; mostra totais acumulados. Períodos específicos somam snapshots diários coletados pelo cron UTMify.
      </p>

      <DateRangeFilter />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base">Configurar Comparação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Step 1: Select dimension */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1. Dimensão
            </label>
            <Select onValueChange={handleDimensionChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Escolha uma dimensão..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(dimensionLabels) as Dimension[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {dimensionLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select items */}
          {dimension && optionsLoaded && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  2. Item A
                </label>
                <Select
                  onValueChange={(val: string | null) => {
                    setValueA(val);
                    setResult(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o item A..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Item B
                </label>
                <Select
                  onValueChange={(val: string | null) => {
                    setValueB(val);
                    setResult(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o item B..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options
                      .filter((opt) => opt.value !== valueA)
                      .map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Compare button */}
          {dimension && optionsLoaded && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCompare}
                disabled={!canCompare || isPending}
                className="transition-all duration-150"
              >
                {isPending ? "Comparando..." : "Comparar"}
              </Button>
              {valueA && valueB && valueA === valueB && (
                <p className="text-xs text-danger">
                  Selecione itens diferentes para comparar.
                </p>
              )}
            </div>
          )}

          {dimension && !optionsLoaded && isPending && (
            <p className="text-sm text-muted-foreground">Carregando opções...</p>
          )}
        </CardContent>
      </Card>

      {/* Results or empty prompt */}
      {result ? (
        <ComparisonView dataA={result[0]} dataB={result[1]} />
      ) : (
        !dimension && (
          <EmptyState
            icon={ArrowLeftRight}
            title="Selecione uma dimensão para comparar"
            description="Escolha a dimensão e dois itens acima para visualizar a comparação lado a lado."
          />
        )
      )}
    </div>
  );
}

export function ComparePageClient({ filterOptions }: ComparePageClientProps) {
  return (
    <Suspense fallback={<div className="h-8" />}>
      <ComparePageInner filterOptions={filterOptions} />
    </Suspense>
  );
}
