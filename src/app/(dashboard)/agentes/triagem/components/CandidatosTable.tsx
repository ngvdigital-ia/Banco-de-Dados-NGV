"use client";

import { Badge } from "@/components/ui/badge";
import { ChevronRight, Inbox } from "lucide-react";
import type { CandidatoTriado } from "@/lib/agentes/triagem/client";

interface Props {
  candidatos: CandidatoTriado[];
  totalSemFiltro: number;
  onSelecionar: (c: CandidatoTriado) => void;
}

function classifBadgeColor(c: string): string {
  if (c === "MUITO_BOM") return "bg-green-100 text-green-900 hover:bg-green-100";
  if (c === "TALVEZ") return "bg-amber-100 text-amber-900 hover:bg-amber-100";
  if (c === "DESCARTAR") return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return "bg-muted text-muted-foreground";
}

function classifLabel(c: string): string {
  if (c === "MUITO_BOM") return "Muito bom";
  if (c === "TALVEZ") return "Talvez";
  if (c === "DESCARTAR") return "Descartar";
  return c;
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function CandidatosTable({
  candidatos,
  totalSemFiltro,
  onSelecionar,
}: Props) {
  if (candidatos.length === 0) {
    return (
      <div className="bg-card border rounded-md p-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium mb-1">Nenhum candidato encontrado</p>
        <p className="text-xs text-muted-foreground">
          {totalSemFiltro === 0
            ? "Quando alguém preencher o formulário, aparece aqui."
            : "Ajuste os filtros pra ver mais resultados."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">
              Data
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">
              Nome
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase hidden md:table-cell">
              Vaga
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">
              Classificação
            </th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {candidatos.map((c) => (
            <tr
              key={c.id}
              className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onSelecionar(c)}
            >
              <td className="px-4 py-2.5 text-muted-foreground">
                {formatDate(c.timestamp)}
              </td>
              <td className="px-4 py-2.5 font-medium">
                <div>{c.nome || "—"}</div>
                {c.email && (
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                )}
              </td>
              <td className="px-4 py-2.5 hidden md:table-cell capitalize">
                {String(c.vaga) || "—"}
              </td>
              <td className="px-4 py-2.5">
                <Badge
                  className={`${classifBadgeColor(String(c.classificacao))} text-[10px] font-medium`}
                >
                  {classifLabel(String(c.classificacao))}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
