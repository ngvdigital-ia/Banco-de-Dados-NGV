import { formatCount, formatDate, formatPeriodo } from "./format";
import type { SpyModuleEstadoData } from "./types";

export function LeiturasPanel({ data }: { data: SpyModuleEstadoData }) {
  const nomesPorId = new Map(data.ofertas.map((oferta) => [oferta.id, oferta.nome]));
  const leituras = [...data.leituras].sort((a, b) => {
    if (a.data !== b.data) return a.data > b.data ? -1 : 1; // mais recente primeiro
    if (a.periodo === b.periodo) return 0;
    return a.periodo === "noite" ? -1 : 1;
  });

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Histórico de leituras</h2>
        <p className="mt-1 text-xs text-muted-foreground">Todas as leituras registradas no Spy, mais recente primeiro.</p>
      </div>

      {leituras.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma leitura registrada ainda.</p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="p-3 text-left font-medium">Oferta</th>
                <th className="p-3 text-left font-medium">Data</th>
                <th className="p-3 text-left font-medium">Período</th>
                <th className="p-3 text-right font-medium">Anúncios</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leituras.map((leitura) => (
                <tr key={leitura.id}>
                  <td className="max-w-[16rem] truncate p-3">{nomesPorId.get(leitura.ofertaId) ?? leitura.ofertaId}</td>
                  <td className="whitespace-nowrap p-3">{formatDate(leitura.data)}</td>
                  <td className="whitespace-nowrap p-3">{formatPeriodo(leitura.periodo)}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{formatCount(leitura.ads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
