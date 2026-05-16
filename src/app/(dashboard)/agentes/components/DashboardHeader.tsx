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
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agentes NGV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atualizado {formatRelativeTime(atualizadoEm)} · {totalOfertas} ofertas
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/agentes/triagem">
          <Button variant="ghost" size="sm" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Candidatos triados
          </Button>
        </Link>
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Atualizando" : "Atualizar"}
        </Button>
      </div>
    </header>
  );
}
