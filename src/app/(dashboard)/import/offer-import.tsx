"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

        // Find the header row (first row that contains "Oferta")
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

        // Convert to objects
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
    <Card>
      <CardHeader>
        <CardTitle>Importar Acompanhamento de Oferta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Importe a planilha de acompanhamento de ofertas (formato Meta Ads Tracking).
          Cada linha vira um projeto com status, copywriter, editor e observações.
        </p>

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 hover:bg-muted">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">{fileName || "Selecionar CSV de acompanhamento"}</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>

        {result && <p className="text-sm font-medium text-green-600">{result}</p>}

        {offers.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {offers.length} oferta(s) encontrada(s):
            </p>
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Copy VSL</TableHead>
                    <TableHead>Copy ADS</TableHead>
                    <TableHead>Editor</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Língua</TableHead>
                    <TableHead>Ads</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((o, i) => {
                    const status = mapStatus(o.validation, o.preScale, o.scale);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell className="text-xs">{o.copyVsl || "-"}</TableCell>
                        <TableCell className="text-xs">{o.copyAds || "-"}</TableCell>
                        <TableCell className="text-xs">{o.editorAds || "-"}</TableCell>
                        <TableCell>{o.ticket || "-"}</TableCell>
                        <TableCell>{mapLanguage(o.language)}</TableCell>
                        <TableCell>{o.adsCount}</TableCell>
                        <TableCell>
                          <Badge variant={status === "escalou" ? "default" : status === "nao_escalou" ? "destructive" : "outline"}>
                            {status === "escalou" ? "Escalou" : status === "nao_escalou" ? "Não Escalou" : status === "rodando" ? "Rodando" : "Em Teste"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{o.notes || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? "Importando..." : `Importar ${offers.length} ofertas`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
