"use client";

import { useState, useTransition } from "react";
import { Upload, FileText, Database } from "lucide-react";
import Papa from "papaparse";
import { OfferImport } from "./offer-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { importMetrics } from "./actions";

type CsvRow = Record<string, string>;

export default function ImportPage() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CsvRow[];
        setRows(data);
        if (data.length > 0) {
          setHeaders(Object.keys(data[0]));
        }
      },
    });
  }

  function handleImport() {
    startTransition(async () => {
      const mapped = rows.map((row) => ({
        date: row.date || row.data || new Date().toISOString().split("T")[0],
        entityType: row.entity_type || row.entityType || "project",
        entityId: Number(row.entity_id || row.entityId || row.project_id || row.projectId || 0),
        impressions: row.impressions ? Number(row.impressions) : null,
        clicks: row.clicks || row.cliques ? Number(row.clicks || row.cliques) : null,
        spend: row.spend || row.gasto || null,
        revenue: row.revenue || row.receita || null,
        cpa: row.cpa || null,
        roas: row.roas || null,
      }));

      const res = await importMetrics(mapped);
      setResult(`${res.imported} linhas importadas com sucesso!`);
      setRows([]);
      setHeaders([]);
      setFileName("");
    });
  }

  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header inline — import page é client, PageHeader é server-safe mas não precisa de importação especial */}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Importar Dados</h1>
        <p className="text-sm text-muted-foreground">
          Importe ofertas e métricas via CSV para popular o dashboard.
        </p>
      </header>

      {/* Seção: Ofertas */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2">
            <Database className="size-4 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold">Acompanhamento de Ofertas</h2>
        </div>
        <OfferImport />
      </section>

      {/* Seção: Métricas CSV */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2">
            <FileText className="size-4 text-primary" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold">Métricas (CSV)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Colunas suportadas: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">date</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">entity_id</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">impressions</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">clicks</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">spend</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">revenue</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">cpa</span>, <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded border border-border">roas</span>.
        </p>

        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-base">Upload</CardTitle>
            <CardDescription>
              Selecione um arquivo CSV formatado para pré-visualizar e importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {/* Dropzone */}
            <label
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border px-5 py-4 text-sm transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5"
              aria-label="Selecionar arquivo CSV"
            >
              <Upload className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className={fileName ? "text-foreground font-medium" : "text-muted-foreground"}>
                {fileName || "Selecionar arquivo CSV"}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {result && (
              <p className="text-sm font-medium text-success">{result}</p>
            )}

            {preview.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Preview —{" "}
                  <span className="tabular-nums font-medium text-foreground">{rows.length}</span> linha(s) total, mostrando 5:
                </p>
                <div className="rounded-xl border border-border overflow-auto max-h-[300px] shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {headers.map((h) => (
                          <TableHead key={h} className="text-xs font-semibold whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((row, i) => (
                        <TableRow key={i} className="transition-colors hover:bg-muted/30">
                          {headers.map((h) => (
                            <TableCell key={h} className="text-xs tabular-nums whitespace-nowrap">
                              {row[h]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleImport} disabled={isPending}>
                    {isPending ? "Importando…" : `Importar ${rows.length} linha(s)`}
                  </Button>
                  {isPending && (
                    <p className="text-xs text-muted-foreground animate-pulse">Processando…</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
