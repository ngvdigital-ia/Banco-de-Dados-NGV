"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw, ClipboardCheck } from "lucide-react";

interface DashboardHeaderProps {
  totalOfertas: number;
  atualizadoEm: string;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h`;
}

export function DashboardHeader({
  totalOfertas,
  atualizadoEm,
  onRefresh,
  isRefreshing,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agentes NGV</h1>
          <p className="text-[13px] text-muted-foreground">
            Atualizado {formatRelativeTime(atualizadoEm)}
          </p>
        </div>
        <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 text-[11px] font-mono font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          {totalOfertas} ofertas
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/agentes/triagem">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Candidatos triados
          </Button>
        </Link>
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs font-medium"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Atualizando" : "Atualizar"}
        </Button>
      </div>
    </header>
  );
}
