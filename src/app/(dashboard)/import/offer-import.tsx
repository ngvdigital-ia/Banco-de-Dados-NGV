"use client";

import { useState, useTransition } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { importOfferTracking } from "./actions";

type RawRow = Record<string, string>;

type ParsedOffer = {
  name: string;
  copyVsl: string;
  copyAds: string;
  editorAds: string;
  editorVsl: string;
  ticket: string;
  language: string;
  vslReady: string;
  adsCount: number;
  adsRejected: number;
  validation: string;
  preScale: string;
  scale: string;
  productCreated: string;
  siteCreated: string;
  notes: string;
};

function parseRow(row: RawRow): ParsedOffer | null {
  const name = (row["Oferta"] || row["oferta"] || "").trim();
  if (!name) return null;

  return {
    name,
    copyVsl: (row["Copy da VSL"] || row["copy da vsl"] || "").trim(),
    copyAds: (row["Copy ADS"] || row["copy ads"] || "").trim(),
    editorAds: (row["Editor dos Ads"] || row["editor dos ads"] || "").trim(),
    editorVsl: (row["Editor da VSL"] || row["editor da vsl"] || "").trim(),
    ticket: (row["Ticket"] || row["ticket"] || "").trim(),
    language: (row["Língua"] || row["lingua"] || row["Lingua"] || "EN").trim(),
    vslReady: (row["VSL no Vturb"] || row["vsl no vturb"] || "").trim(),
    adsCount: parseInt(row["ADS Editados (qtd)"] || row["ads editados (qtd)"] || "0") || 0,
    adsRejected: parseInt(row["ADS Rejeitados (qtd)"] || row["ads rejeitados (qtd)"] || "0") || 0,
    validation: (row["Validação da oferta"] || row["validação da oferta"] || "").trim(),
    preScale: (row["Pré escala"] || row["pré escala"] || "").trim(),
    scale: (row["Escala"] || row["escala"] || "").trim(),
    productCreated: (row["Produto criado"] || row["produto criado"] || "").trim(),
    siteCreated: (row["Site criado"] || row["site criado"] || "").trim(),
    notes: (row["Observações"] || row["observações"] || row["Observacoes"] || "").trim(),
  };
}

function mapStatus(validation: string, preScale: string, scale: string): string {
  const v = validation.toUpperCase();
  const p = preScale.toUpperCase();
  const s = scale.toUpperCase();

  if (s === "SIM" || s === "NÃO" && p === "SIM") return "escalou";
  if (p === "SIM" || v === "SIM") return "rodando";
  if (v === "EM ANDAMENTO" || p === "EM ANDAMENTO" || s === "EM ANDAMENTO") return "em_teste";
  if (v === "NÃO DEU CERTO" || v === "NÃO") return "nao_escalou";
  return "em_teste";
}

function mapLanguage(lang: string): string {
  const l = lang.toUpperCase();
  if (l === "EN") return "Inglês";
  if (l === "FR") return "Francês";
  if (l === "DE") return "Alemão";
  if (l === "ITA" || l === "IT") return "Italiano";
  if (l === "ES") return "Espanhol";
  if (l === "PT" || l === "BR") return "Português";
  return lang;
}

type StatusKey = "escalou" | "nao_escalou" | "rodando" | "em_teste";
const statusVariant: Record<StatusKey, "success" | "danger" | "warning" | "neutral"> = {
  escalou: "success",
  nao_escalou: "danger",
  rodando: "warning",
  em_teste: "neutral",
};
const statusLabel: Record<StatusKey, string> = {
  escalou: "Escalou",
  nao_escalou: "Não Escalou",
  rodando: "Rodando",
  em_teste: "Em Teste",
};

export function OfferImport() {
  const [offers, setOffers] = useState<ParsedOffer[]>([]);
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const allRows = results.data as string[][];

        let headerIndex = -1;
        for (let i = 0; i < allRows.length; i++) {
          if (allRows[i].some((cell) => cell && cell.toString().trim().toLowerCase().includes("oferta"))) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          setResult("Erro: Não encontrei a coluna 'Oferta' no CSV. Verifique o formato.");
          return;
        }

        const headers = allRows[headerIndex].map((h) => h.toString().trim());
        const dataRows = allRows.slice(headerIndex + 1);

        const mapped: RawRow[] = dataRows
          .filter((row) => row.some((cell) => cell && cell.toString().trim() !== ""))
          .map((row) => {
            const obj: RawRow = {};
            headers.forEach((h, i) => {
              if (h) obj[h] = (row[i] || "").toString().trim();
            });
            return obj;
          });

        const parsed = mapped
          .map(parseRow)
          .filter((r): r is ParsedOffer => r !== null);
        setOffers(parsed);

        if (parsed.length === 0) {
          setResult("Nenhuma oferta encontrada. Verifique se a planilha tem dados abaixo do cabeçalho.");
        }
      },
    });
  }

  function handleImport() {
    startTransition(async () => {
      const mapped = offers.map((o) => ({
        name: o.name,
        niche: "Emagrecimento",
        language: mapLanguage(o.language),
        status: mapStatus(o.validation, o.preScale, o.scale),
        ticket: o.ticket,
        copyVsl: o.copyVsl,
        copyAds: o.copyAds,
        editorAds: o.editorAds,
        editorVsl: o.editorVsl,
        adsCount: o.adsCount,
        adsRejected: o.adsRejected,
        validation: o.validation,
        preScale: o.preScale,
        scale: o.scale,
        notes: o.notes,
      }));

      const res = await importOfferTracking(mapped);
      setResult(res);
      setOffers([]);
      setFileName("");
    });
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4 border-b border-border">
        <CardTitle className="text-base">Importar Acompanhamento de Oferta</CardTitle>
        <CardDescription>
          Importe a planilha de acompanhamento de ofertas (formato Meta Ads Tracking).
          Cada linha vira um projeto com status, copywriter, editor e observações.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {/* Dropzone */}
        <label
          className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border px-5 py-4 text-sm transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5"
          aria-label="Selecionar CSV de acompanhamento"
        >
          <Upload className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className={fileName ? "text-foreground font-medium" : "text-muted-foreground"}>
            {fileName || "Selecionar CSV de acompanhamento"}
          </span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>

        {/* Resultado */}
        {result && (
          <div className="flex items-center gap-2 rounded-lg bg-success-muted border border-success px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-success-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-success-muted-foreground">{result}</p>
          </div>
        )}

        {/* Preview */}
        {offers.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground">{offers.length}</span> oferta(s) encontrada(s):
            </p>
            <div className="rounded-xl border border-border overflow-auto max-h-[400px] shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Oferta</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Copy VSL</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Copy ADS</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Editor</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Ticket</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Língua</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Ads</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((o, i) => {
                    const status = mapStatus(o.validation, o.preScale, o.scale) as StatusKey;
                    return (
                      <TableRow key={i} className="transition-colors duration-150 hover:bg-muted/30">
                        <TableCell className="font-medium whitespace-nowrap">{o.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.copyVsl || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.copyAds || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.editorAds || "—"}</TableCell>
                        <TableCell className="tabular-nums text-sm">{o.ticket || "—"}</TableCell>
                        <TableCell className="text-sm">{mapLanguage(o.language)}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm font-medium">{o.adsCount}</TableCell>
                        <TableCell>
                          <StatusBadge variant={statusVariant[status]}>
                            {statusLabel[status]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
                          {o.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={isPending}>
                {isPending ? "Importando…" : `Importar ${offers.length} oferta(s)`}
              </Button>
              {isPending && (
                <p className="text-xs text-muted-foreground animate-pulse">Processando…</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
