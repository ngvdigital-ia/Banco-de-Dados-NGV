import { formatCount, formatDate, formatPeriodo } from "./format";
import type { SpyLeitura, SpyModuleEstadoData } from "./types";

// Ordena cronologicamente igual à view spy.ofertas_prontas_pra_modelar do Spy (migrations/002) e
// ao client dele (index.html): mesma data, noite depois de manhã.
function ordenarLeituras(leituras: SpyLeitura[]) {
  return [...leituras].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.periodo === b.periodo) return 0;
    return a.periodo === "manha" ? -1 : 1;
  });
}

export function ProntasPanel({ data }: { data: SpyModuleEstadoData }) {
  // A REGRA de quem está "pronta pra modelar" mora só no Spy (view spy.ofertas_prontas_pra_modelar,
  // ≥7 dias distintos de leitura + última leitura > 100 anúncios + última > 2× a primeira) — este
  // painel nunca recalcula, só cruza os ids que o Spy já decidiu (data.prontasParaModelar) com os
  // dados de ofertas/leituras pra exibir o que o operador precisa pra decidir o que modelar.
  const prontas = data.ofertas.filter((oferta) => data.prontasParaModelar.includes(oferta.id));

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Prontas pra modelar</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Regra calculada no Spy — este painel só exibe o resultado, nunca recalcula quem qualifica.
        </p>
      </div>

      {prontas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma oferta pronta pra modelar no momento.</p>
      ) : (
        <div className="divide-y">
          {prontas.map((oferta) => {
            const leiturasDaOferta = ordenarLeituras(data.leituras.filter((l) => l.ofertaId === oferta.id));
            const primeira = leiturasDaOferta[0];
            const ultima = leiturasDaOferta[leiturasDaOferta.length - 1];

            return (
              <div key={oferta.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{oferta.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[oferta.formato, oferta.nicho, oferta.idioma].filter(Boolean).join(" · ") || "Sem classificação"}
                  </p>
                  {oferta.link ? (
                    <a
                      href={oferta.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block max-w-full truncate text-xs text-primary underline underline-offset-2"
                    >
                      {oferta.link}
                    </a>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {primeira ? (
                    <>
                      1ª leitura: <span className="font-mono tabular-nums text-foreground">{formatCount(primeira.ads)}</span> em{" "}
                      {formatDate(primeira.data)} ({formatPeriodo(primeira.periodo)})
                    </>
                  ) : (
                    "Sem leitura"
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ultima ? (
                    <>
                      Última: <span className="font-mono tabular-nums text-foreground">{formatCount(ultima.ads)}</span> em{" "}
                      {formatDate(ultima.data)} ({formatPeriodo(ultima.periodo)})
                    </>
                  ) : (
                    "Sem leitura"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
