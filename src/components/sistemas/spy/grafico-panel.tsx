"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { avaliarTodasOfertas, ordemLeitura, porDia, serieDaOferta } from "./avaliacao.mjs";
import { formatDate } from "./format";
import type { SpyLeitura, SpyModuleEstadoData, SpyOferta } from "./types";

// Aba "Gráfico" — porta de workspaces/spy-analytics/index.html (marcação :408-425, render
// :987-1338: `graficoLinha` para os modos "linha"/"dia", `graficoPeriodo` para "periodo").
//
// DECISÃO DELIBERADA (critério do handoff: "prefira reusar recharts, já é o padrão do Banco NGV,
// desde que os 3 modos e a leitura visual fiquem equivalentes"): os 3 modos são recharts puro
// (LineChart pros dois primeiros, BarChart agrupado pro terceiro) — nenhum SVG à mão. O original
// desenha o SVG na unha porque não tinha nenhuma lib de gráfico; aqui já existe recharts como
// padrão (ver src/components/charts/team-monthly-chart.tsx, mesmo formato de pivô usado abaixo).
// Uma única perda de fidelidade visual, não-estrutural: o original marca cada ponto do modo "cada
// leitura" com círculo vazado (manhã) vs cheio (noite); recharts não expõe esse nível de
// customização por PONTO sem um <Dot> custom por série (complexidade alta pra um detalhe
// decorativo). Fica equivalente por outro caminho: o rótulo do eixo X já carrega "m"/"n" por
// leitura (ver `rotuloSlotLeitura`), então a distinção manhã/noite não se perde, só muda de forma.
type Modo = "linha" | "dia" | "periodo";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const MODOS: { value: Modo; label: string }[] = [
  { value: "linha", label: "Cada leitura" },
  { value: "dia", label: "Média do dia" },
  { value: "periodo", label: "Manhã × Noite" },
];

// chave = data + "A"/"B" (mesmo formato de `ordemLeitura` de avaliacao.mjs) — ex.: "2026-08-10A".
function rotuloSlotLeitura(chave: string): string {
  const data = chave.slice(0, 10);
  const periodo = chave.endsWith("A") ? "m" : "n";
  return `${formatDate(data)} ${periodo}`;
}

// Pivota "1 série por oferta" pra "1 ponto por slot do eixo X, com uma chave por oferta" — mesmo
// formato que o Recharts espera (ver buildChartData de src/components/charts/team-monthly-chart.tsx,
// reaproveitado aqui em vez de reinventar). `slots` é a UNIÃO das leituras/dias de todas as ofertas
// selecionadas — igual ao `slots` do original (index.html:1099-1107), então uma oferta sem leitura
// num slot simplesmente não aparece nesse ponto (Line com connectNulls fecha o buraco visualmente).
function construirPontosLinha(ofertas: SpyOferta[], leituras: SpyLeitura[], agrupaDia: boolean) {
  const porOferta = new Map<string, Map<string, number>>();
  const slots = new Set<string>();
  ofertas.forEach((o) => {
    const serie = serieDaOferta(leituras, o.id);
    const pontos = new Map<string, number>();
    if (agrupaDia) {
      porDia(serie).forEach((d) => {
        pontos.set(d.data, d.ads);
        slots.add(d.data);
      });
    } else {
      serie.forEach((l) => {
        const chave = ordemLeitura(l);
        pontos.set(chave, l.ads);
        slots.add(chave);
      });
    }
    porOferta.set(o.id, pontos);
  });
  return [...slots].sort().map((slot) => {
    const ponto: Record<string, number | string> = {
      slot,
      rotulo: agrupaDia ? formatDate(slot) : rotuloSlotLeitura(slot),
    };
    ofertas.forEach((o) => {
      const valor = porOferta.get(o.id)?.get(slot);
      if (valor !== undefined) ponto[o.nome] = Math.round(valor * 10) / 10;
    });
    return ponto;
  });
}

// Média de manhã e de noite por oferta — idêntico ao cálculo de `graficoPeriodo` do original
// (index.html:1299-1304).
function construirDadosPeriodo(ofertas: SpyOferta[], leituras: SpyLeitura[]) {
  const media = (valores: number[]) => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0);
  return ofertas.map((o) => {
    const serie = serieDaOferta(leituras, o.id);
    const manha = serie.filter((l) => l.periodo === "manha").map((l) => l.ads);
    const noite = serie.filter((l) => l.periodo === "noite").map((l) => l.ads);
    return {
      nome: o.nome,
      manha: Math.round(media(manha) * 10) / 10,
      noite: Math.round(media(noite) * 10) / 10,
    };
  });
}

export function GraficoPanel({ data }: { data: SpyModuleEstadoData }) {
  const [modo, setModo] = useState<Modo>("linha");
  const [selecao, setSelecao] = useState<string[]>([]);

  const mapa = useMemo(
    () => avaliarTodasOfertas(data.ofertas, data.leituras, data.pesos, data.tolerancia),
    [data.ofertas, data.leituras, data.pesos, data.tolerancia],
  );

  const ofertasComLeitura = useMemo(() => data.ofertas.filter((o) => mapa[o.id]?.n > 0), [data.ofertas, mapa]);
  const selecionadas = useMemo(
    () => ofertasComLeitura.filter((o) => selecao.includes(o.id)),
    [ofertasComLeitura, selecao],
  );

  function alternar(id: string) {
    setSelecao((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }
  function selecionarTop5() {
    setSelecao(
      [...ofertasComLeitura]
        .sort((a, b) => mapa[b.id].nota - mapa[a.id].nota)
        .slice(0, 5)
        .map((o) => o.id),
    );
  }
  function selecionarTodas() {
    setSelecao(ofertasComLeitura.map((o) => o.id));
  }
  function limparSelecao() {
    setSelecao([]);
  }

  const dadosLinha = useMemo(
    () => (modo !== "periodo" ? construirPontosLinha(selecionadas, data.leituras, modo === "dia") : []),
    [modo, selecionadas, data.leituras],
  );
  const dadosPeriodo = useMemo(
    () => (modo === "periodo" ? construirDadosPeriodo(selecionadas, data.leituras) : []),
    [modo, selecionadas, data.leituras],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Comparar ofertas</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border" role="group" aria-label="Visão do gráfico">
            {MODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={modo === m.value}
                onClick={() => setModo(m.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  modo === m.value ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={selecionarTop5} disabled={!ofertasComLeitura.length}>
            Selecionar top 5
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={selecionarTodas} disabled={!ofertasComLeitura.length}>
            Selecionar todas
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={limparSelecao} disabled={!selecao.length}>
            Limpar seleção
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ofertasComLeitura.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhuma oferta com leitura ainda.</span>
          ) : (
            ofertasComLeitura.map((o, i) => (
              <label
                key={o.id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  selecao.includes(o.id) ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <Checkbox checked={selecao.includes(o.id)} onCheckedChange={() => alternar(o.id)} />
                <span className="size-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {o.nome}
              </label>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        {selecionadas.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Escolha ao menos uma oferta — os chips acima ligam e desligam cada linha.
          </div>
        ) : modo === "periodo" ? (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={dadosPeriodo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                formatter={(value, name) => [`${value} anúncios em média`, name === "manha" ? "Manhã" : "Noite"]}
              />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === "manha" ? "Manhã" : "Noite")} />
              <Bar dataKey="manha" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="noite" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={dadosLinha} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 10.5 }} className="text-muted-foreground" minTickGap={24} />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />
              {selecionadas.map((o, i) => (
                <Line
                  key={o.id}
                  type="monotone"
                  dataKey={o.nome}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {modo === "dia"
            ? "cada ponto é a média das leituras do dia"
            : modo === "periodo"
              ? "média de todas as leituras do período"
              : "m = manhã · n = noite, no rótulo do eixo"}
        </p>
      </div>
    </div>
  );
}
