"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setResult("Sincronizado com sucesso!");
      } else {
        setResult(`Erro: ${data.error ?? "Falha na sincronização"}`);
      }
    } catch {
      setResult("Erro de rede ao sincronizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleSync} disabled={loading} variant="outline" size="sm">
        <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando..." : label}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
