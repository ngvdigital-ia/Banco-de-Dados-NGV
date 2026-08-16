import { avaliarTodasOfertas, resumoOfertas } from "./avaliacao.mjs";
import { formatCount } from "./format";
import type { SpyModuleEstadoData } from "./types";

// Os 4 KPIs do topo do módulo. Corrigido pra bater com os 4 do Painel original
// (workspaces/spy-analytics/index.html:799-803: "Anúncios monitorados", "Prontas para traduzir",
// "Sem quebra de escala", "Primeira da fila") — os 4 anteriores ("Ofertas monitoradas", "Leituras
// registradas", "Prontas pra modelar", "Tolerância de critério") misturavam contagem bruta com um
// PARÂMETRO de critério (tolerância não é indicador, é entrada da fórmula).
//
// Diferença deliberada em relação à aba Painel (painel-panel.tsx): aqui não há filtro (este card
// fica fora da navegação por aba), então os 4 KPIs somam sobre TODAS as ofertas — equivalente ao
// que o original mostra quando nenhum filtro está ativo.
export function SummaryCards({ data }: { data: SpyModuleEstadoData }) {
  const mapa = avaliarTodasOfertas(data.ofertas, data.leituras, data.pesos, data.tolerancia);
  const resumo = resumoOfertas(data.ofertas, mapa);
  const liderAvaliacao = resumo.lider ? mapa[resumo.lider.id] : null;

  return (
    <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do Spy Analytics">
      <div className="min-h-24 p-4">
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{formatCount(resumo.totalAds)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Anúncios monitorados</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">somando a última leitura de cada oferta</p>
      </div>
      <div className="min-h-24 border-t p-4 sm:border-t-0 sm:border-l">
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-success">{formatCount(resumo.prontas)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Prontas para traduzir</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">nota 75 ou mais</p>
      </div>
      <div className="min-h-24 border-t p-4 sm:border-t-0 sm:border-l lg:border-l">
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-info">{formatCount(resumo.semQuebra)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Sem quebra de escala</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">seguraram a contagem todos os dias</p>
      </div>
      <div className="min-h-24 border-t p-4 sm:border-t-0 sm:border-l">
        <p className="truncate text-lg font-semibold tracking-tight">{resumo.lider ? resumo.lider.nome : "—"}</p>
        <p className="mt-2 text-xs text-muted-foreground">Primeira da fila</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {resumo.lider && liderAvaliacao ? `${liderAvaliacao.nota} de nota · ${liderAvaliacao.dias} dias em análise` : "nenhuma oferta com leitura"}
        </p>
      </div>
    </section>
  );
}
