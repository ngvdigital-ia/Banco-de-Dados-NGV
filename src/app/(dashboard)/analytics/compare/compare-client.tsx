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

    // Deriva opcoes diretamente do filterOptions ja carregado no servidor — sem round-trip
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Comparar</h1>
      <p className="text-muted-foreground">
        Compare metricas entre nichos, idiomas, copywriters ou editores lado a lado.
      </p>
      <p className="text-xs text-muted-foreground">
        Periodo &quot;Tudo&quot; mostra totais acumulados. Periodos especificos somam snapshots diarios coletados pelo cron UTMify.
      </p>

      <DateRangeFilter />

      <Card>
        <CardHeader>
          <CardTitle>Configurar Comparacao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Select dimension */}
          <div className="space-y-2">
            <label className="text-sm font-medium">1. Selecione a dimensao</label>
            <Select onValueChange={handleDimensionChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Escolha uma dimensao..." />
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
                <label className="text-sm font-medium">2. Item A</label>
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
                <label className="text-sm font-medium">Item B</label>
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
            <div>
              <Button
                onClick={handleCompare}
                disabled={!canCompare || isPending}
              >
                {isPending ? "Comparando..." : "Comparar"}
              </Button>
              {valueA && valueB && valueA === valueB && (
                <p className="mt-1 text-xs text-red-500">
                  Selecione itens diferentes para comparar.
                </p>
              )}
            </div>
          )}

          {dimension && !optionsLoaded && isPending && (
            <p className="text-sm text-muted-foreground">Carregando opcoes...</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <ComparisonView dataA={result[0]} dataB={result[1]} />
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
