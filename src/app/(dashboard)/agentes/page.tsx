import { aggregateOfertas } from "@/lib/agentes/ofertas/aggregate";
import { KanbanBoard } from "./components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  let ofertas: Awaited<ReturnType<typeof aggregateOfertas>> = [];
  let erro: string | null = null;
  try {
    ofertas = await aggregateOfertas();
  } catch (err) {
    console.error("Erro ao agregar ofertas (server-side):", err);
    erro = err instanceof Error ? err.message : "Erro desconhecido";
  }

  if (erro) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium mb-2">
            Não foi possível carregar ofertas
          </p>
          <p className="text-xs text-muted-foreground mb-4">{erro}</p>
          <p className="text-xs text-muted-foreground">
            Verifica env vars (N8N_API_KEY, ANTHROPIC_API_KEY, CLICKUP_API_TOKEN)
            ou tenta recarregar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <KanbanBoard
      initialOfertas={ofertas}
      initialAtualizadoEm={new Date().toISOString()}
    />
  );
}
