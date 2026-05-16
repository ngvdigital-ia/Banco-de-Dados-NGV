import { listCandidatos } from "@/lib/agentes/triagem/client";
import { TriagemView } from "./components/TriagemView";

export const dynamic = "force-dynamic";

export default async function TriagemPage() {
  let candidatos: Awaited<ReturnType<typeof listCandidatos>> = [];
  let erro: string | null = null;
  try {
    candidatos = await listCandidatos();
    candidatos.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (err) {
    erro = err instanceof Error ? err.message : "Erro desconhecido";
  }

  if (erro) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium mb-2">
            Não foi possível carregar candidatos
          </p>
          <p className="text-xs text-muted-foreground mb-4">{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <TriagemView
      initialCandidatos={candidatos}
      initialAtualizadoEm={new Date().toISOString()}
    />
  );
}
