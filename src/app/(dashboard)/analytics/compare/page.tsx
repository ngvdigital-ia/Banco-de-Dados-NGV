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
import { getFilterOptions, getComparisonData, type AnalyticsFilters } from "../actions";

type Dimension = "niche" | "language" | "copywriter" | "editor";

type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

const dimensionLabels: Record<Dimension, string> = {
  niche: "Oferta",
  language: "Idioma",
  copywriter: "Copywriter",
  editor: "Editor",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="h-8" />}>
      <ComparePageInner />
    </Suspense>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const [dimension, setDimension] = useState<Dimension | null>(null);
  const [valueA, setValueA] = useState<string | null>(null);
  const [valueB, setValueB] = useState<string | null>(null);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<[ComparisonData, ComparisonData] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null);

  // Base filters state — filters that apply to BOTH sides of the comparison
  const [baseFilterNiche, setBaseFilterNiche] = useState<string | null>(null);
  const [baseFilterLanguage, setBaseFilterLanguage] = useState<string | null>(null);
  const [baseFilterCopywriter, setBaseFilterCopywriter] = useState<string | null>(null);
  const [baseFilterEditor, setBaseFilterEditor] = useState<string | null>(null);

  function handleDimensionChange(val: string | null) {
    if (!val) return;
    const dim = val as Dimension;
    setDimension(dim);
    setValueA(null);
    setValueB(null);
    setResult(null);
    setOptionsLoaded(false);
    // Reset base filters when dimension changes
    setBaseFilterNiche(null);
    setBaseFilterLanguage(null);
    setBaseFilterCopywriter(null);
    setBaseFilterEditor(null);

    // Load options for the selected dimension
    startTransition(async () => {
      const opts = await getFilterOptions();
      setFilterOpts(opts);
      let items: { value: string; label: string }[] = [];

      switch (dim) {
        case "niche":
          items = opts.niches.map((n) => ({ value: n, label: n }));
          break;
        case "language":
          items = opts.languages.map((l) => ({ value: l, label: l }));
          break;
        case "copywriter":
          items = opts.copywriters.map((c) => ({
            value: String(c.id),
            label: c.name,
          }));
          break;
        case "editor":
          items = opts.editors.map((e) => ({
            value: String(e.id),
            label: e.name,
          }));
          break;
      }

      setOptions(items);
      setOptionsLoaded(true);
    });
  }

  function buildBaseFilters(): AnalyticsFilters {
    const filters: AnalyticsFilters = {};
    if (baseFilterNiche) {
      filters.niches = [baseFilterNiche];
    }
    if (baseFilterLanguage) {
      filters.languages = [baseFilterLanguage];
    }
    if (baseFilterCopywriter) {
      filters.copywriterIds = [parseInt(baseFilterCopywriter, 10)];
    }
    if (baseFilterEditor) {
      filters.editorIds = [parseInt(baseFilterEditor, 10)];
    }
    return filters;
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
        Dados refletem o total acumulado. Filtro por periodo sera habilitado apos coleta de historico diario.
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

          {/* Step 1.5: Base filters (for OTHER dimensions) */}
          {dimension && optionsLoaded && filterOpts && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Filtros base (aplicados aos dois lados)</label>
              <div className="flex flex-wrap gap-3">
                {dimension !== "niche" && filterOpts.niches.length > 0 && (
                  <Select
                    value={baseFilterNiche ?? "__all__"}
                    onValueChange={(val: string | null) => {
                      setBaseFilterNiche(val === "__all__" ? null : val);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as Ofertas</SelectItem>
                      {filterOpts.niches.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {dimension !== "language" && (
                  <Select
                    value={baseFilterLanguage ?? "__all__"}
                    onValueChange={(val: string | null) => {
                      setBaseFilterLanguage(val === "__all__" ? null : val);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os Idiomas</SelectItem>
                      {filterOpts.languages.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {dimension !== "copywriter" && (
                  <Select
                    value={baseFilterCopywriter ?? "__all__"}
                    onValueChange={(val: string | null) => {
                      setBaseFilterCopywriter(val === "__all__" ? null : val);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Copywriter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos Copywriters</SelectItem>
                      {filterOpts.copywriters.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {dimension !== "editor" && (
                  <Select
                    value={baseFilterEditor ?? "__all__"}
                    onValueChange={(val: string | null) => {
                      setBaseFilterEditor(val === "__all__" ? null : val);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Editor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos Editores</SelectItem>
                      {filterOpts.editors.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

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
