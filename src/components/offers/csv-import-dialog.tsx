"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
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

        // Find the header row (first row that contains "Oferta")
        let headerIndex = -1;
        for (let i = 0; i < allRows.length; i++) {
          if (
            allRows[i].some(
              (cell) =>
                cell &&
                cell
                  .toString()
                  .trim()
                  .toLowerCase()
                  .includes("oferta")
            )
          ) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          setError(
            'Não encontrei a coluna "Oferta" no CSV. Verifique o formato.'
          );
          setRows([]);
          return;
        }

        const foundHeaders = allRows[headerIndex].map((h) =>
          h.toString().trim()
        );
        setHeaders(foundHeaders);

        const dataRows = allRows.slice(headerIndex + 1);

        const mapped: RawRow[] = dataRows
          .filter((row) =>
            row.some((cell) => cell && cell.toString().trim() !== "")
          )
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

  // Preview: show first 3 rows with key columns
  const previewCols = ["Oferta", "Língua", "Ticket", "Validação da oferta"];
  const visiblePreviewCols = previewCols.filter((c) => headers.includes(c));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="mr-1 h-4 w-4" />
            Importar CSV
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Ofertas via CSV</DialogTitle>
          <DialogDescription>
            Importe a planilha de acompanhamento de ofertas. O sistema procura
            automaticamente a linha de cabeçalho que contém &quot;Oferta&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 hover:bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">
              {fileName || "Selecionar arquivo CSV"}
            </span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          {result && (
            <p className="text-sm font-medium text-emerald-600">{result}</p>
          )}

          {rows.length > 0 && !result && (
            <>
              <p className="text-sm text-muted-foreground">
                {rows.length} oferta(s) encontrada(s). Preview:
              </p>
              <div className="max-h-[200px] overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {visiblePreviewCols.map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 text-left font-medium"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b">
                        {visiblePreviewCols.map((col) => (
                          <td key={col} className="px-2 py-1">
                            {row[col] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length > 3 && (
                      <tr>
                        <td
                          colSpan={visiblePreviewCols.length}
                          className="px-2 py-1 text-center text-muted-foreground"
                        >
                          ... e mais {rows.length - 3} linha(s)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && !result && (
          <DialogFooter>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending
                ? "Importando..."
                : `Importar ${rows.length} ofertas`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
