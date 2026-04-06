"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { triggerSync } from "./actions";

export function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const res = await triggerSync(endpoint);
      setResult(res);
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleSync} disabled={isPending} variant="outline" size="sm">
        <RefreshCw className={`mr-2 h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Sincronizando..." : label}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
