"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="max-w-md border-l-[3px] border-l-danger bg-card p-6 ring-1 ring-foreground/10"
        role="alert"
      >
        <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold">
          Não foi possível carregar esta tela
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ocorreu um erro ao buscar os dados. Tente novamente em instantes.
        </p>
        <Button type="button" onClick={reset} className="mt-4">
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
