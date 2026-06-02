"use client";

import { useState, useTransition } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importOffers } from "@/app/(dashboard)/offers/actions";
import { cn } from "@/lib/utils";

type RawRow = Record<string, string>;

export function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const allRows = results.data as string[][];

        let headerIndex = -1;
        for (let i = 0; i < allRows.length; i++) {
          if (
            allRows[i].some(
              (cell) =>
                cell &&
                cell.toString().trim().toLowerCase().includes("oferta")
            )
          ) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          setError('Não encontrei a coluna "Oferta" no CSV. Verifique o formato.');
          setRows([]);
          return;
        }

        const foundHeaders = allRows[headerIndex].map((h) => h.toString().trim());
        setHeaders(foundHeaders);

        const dataRows = allRows.slice(headerIndex + 1);

        const mapped: RawRow[] = dataRows
          .filter((row) => row.some((cell) => cell && cell.toString().trim() !== ""))
          .map((row) => {
            const obj: RawRow = {};
            foundHeaders.forEach((h, i) => {
              if (h) obj[h] = (row[i] || "").toString().trim();
            });
            return obj;
          })
          .filter((obj) => obj["Oferta"] || obj["oferta"]);

        setRows(mapped);

        if (mapped.length === 0) {
          setError(
            "Nenhuma oferta encontrada. Verifique se a planilha tem dados abaixo do cabeçalho."
          );
        }
      },
    });
  }

  function handleImport() {
    startTransition(async () => {
      const res = await importOffers(rows);
      setResult(typeof res === "string" ? res : "Importação concluída!");
      setRows([]);
      setFileName("");
      setTimeout(() => setOpen(false), 1500);
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setRows([]);
      setHeaders([]);
      setFileName("");
      setError(null);
      setResult(null);
    }
  }

  const previewCols = ["Oferta", "Língua", "Ticket", "Validação da oferta"];
  const visiblePreviewCols = previewCols.filter((c) => headers.includes(c));
  const hasFile = !!fileName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="mr-1.5 h-4 w-4" />
            Importar CSV
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Ofertas via CSV</DialogTitle>
          <DialogDescription>
            O sistema detecta automaticamente a linha de cabeçalho que contém
            &quot;Oferta&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <label
            className={cn(
              "group relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200",
              hasFile
                ? "border-primary/50 bg-primary/4"
                : "border-border hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
                hasFile ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {hasFile ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Upload className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
              )}
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  hasFile ? "text-primary" : "text-foreground",
                )}
              >
                {fileName || "Selecionar arquivo CSV"}
              </p>
              {!hasFile && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Clique ou arraste aqui
                </p>
              )}
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>

          {/* Feedback de erro */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-muted px-3 py-2.5 text-xs text-danger-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Feedback de sucesso */}
          {result && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-muted px-3 py-2.5 text-xs text-success-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              <span>{result}</span>
            </div>
          )}

          {/* Preview da tabela */}
          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Preview
                </p>
                <span className="tabular-nums rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {rows.length} oferta{rows.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-[200px] overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {visiblePreviewCols.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-semibold text-muted-foreground tracking-wide"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors duration-100"
                      >
                        {visiblePreviewCols.map((col) => (
                          <td key={col} className="px-3 py-2 text-muted-foreground">
                            {row[col] || (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length > 3 && (
                      <tr>
                        <td
                          colSpan={visiblePreviewCols.length}
                          className="px-3 py-2 text-center text-muted-foreground/60 italic"
                        >
                          + {rows.length - 3} linha{rows.length - 3 !== 1 ? "s" : ""} oculta
                          {rows.length - 3 !== 1 ? "s" : ""}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {rows.length > 0 && !result && (
          <DialogFooter className="pt-2">
            <Button onClick={handleImport} disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>Importando…</>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Importar {rows.length} oferta{rows.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
