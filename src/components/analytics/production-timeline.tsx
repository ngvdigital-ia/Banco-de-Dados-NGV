"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OfferProductionEntry } from "@/app/(dashboard)/analytics/actions";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDateFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function gapDays(prevIso: string, currIso: string): number {
  return Math.round(
    (new Date(currIso).getTime() - new Date(prevIso).getTime()) / 86400000
  );
}

function GapBadge({ days }: { days: number }) {
  if (days < 5) return null;
  const cls =
    days >= 10
      ? "text-danger font-semibold"
      : "text-warning font-semibold";
  return (
    <span className={`ml-2 tabular-nums text-xs ${cls}`}>+{days}d</span>
  );
}

function ExpandedStages({ stages }: { stages: OfferProductionEntry["stages"] }) {
  return (
    <div className="px-4 pb-3 pt-1">
      <ol className="space-y-1 border-l border-border/50 pl-4">
        {stages.map((s, idx) => {
          const gap = idx > 0 ? gapDays(stages[idx - 1].doneAt, s.doneAt) : 0;
          return (
            <li key={idx} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
              <span className="text-muted-foreground tabular-nums text-xs w-16 shrink-0">
                {fmtDateFull(s.doneAt)}
              </span>
              <span className="flex-1 text-sm">{s.stage}</span>
              {idx > 0 && <GapBadge days={gap} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ProductionTimeline({ offers }: { offers: OfferProductionEntry[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="text-base">Linha de produção por oferta</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8 pl-4" />
              <TableHead className="pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Oferta
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Etapas
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Início → Fim
              </TableHead>
              <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Duração (dias)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map((entry, idx) => {
              const isOpen = expanded.has(idx);
              return (
                <>
                  <TableRow
                    key={`row-${idx}`}
                    className={`cursor-pointer select-none ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    onClick={() => toggle(idx)}
                  >
                    <TableCell className="pl-4 pr-0 w-8">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="pl-2 font-medium text-sm">
                      {entry.offer}
                    </TableCell>
                    <TableCell className="tabular-nums text-center text-sm">
                      {entry.stageCount}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {fmtDate(entry.firstDoneAt)} → {fmtDate(entry.lastDoneAt)}
                    </TableCell>
                    <TableCell className="tabular-nums pr-4 text-right text-sm font-semibold">
                      {entry.totalDays}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`exp-${idx}`} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                      <TableCell colSpan={5} className="p-0">
                        <ExpandedStages stages={entry.stages} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
