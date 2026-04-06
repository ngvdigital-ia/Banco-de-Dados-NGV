"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import Papa from "papaparse";
import { OfferImport } from "./offer-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Import</h1>

      <OfferImport />

      <h2 className="text-xl font-bold mt-8">Import de Métricas (CSV)</h2>
      <p className="text-muted-foreground">
        Importe métricas de uma planilha CSV. Colunas suportadas: date, entity_id,
        impressions, clicks, spend, revenue, cpa, roas.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 hover:bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{fileName || "Selecionar arquivo CSV"}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {result && (
            <p className="text-sm font-medium text-green-600">{result}</p>
          )}

          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Preview ({rows.length} linhas total, mostrando 5):
              </p>
              <div className="rounded-md border overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="text-xs">
                            {row[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending ? "Importando..." : `Importar ${rows.length} linhas`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
