"use client";

import { useMemo, useState } from "react";
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { avaliarTodasOfertas, resumoOfertas, situacaoOferta, veredictoDaNota } from "./avaliacao.mjs";
import { formatCount, formatDate, formatPeriodo } from "./format";
import type { SpyLeitura, SpyModuleEstadoData, SpyOferta } from "./types";

// Aba "Painel" — porta fiel de workspaces/spy-analytics/index.html (marcação :328-353, render
// :789-857). A nota/veredito/estabilidade vêm de src/components/sistemas/spy/avaliacao.mjs, o
// núcleo puro que replica `avaliarTodas` do original byte a byte — este arquivo só é
// apresentação (filtro client-side, layout dos KPIs e do ranking).

type Ordem = "nota" | "ads" | "dias" | "estab" | "recente" | "nome";

interface Filtros {
  oferta: string;
  nicho: string;
  idioma: string;
  formato: string;
  minAds: string;
  minDias: string;
  ordem: Ordem;
}

const FILTROS_PADRAO: Filtros = {
  oferta: "__todas__",
  nicho: "__todos__",
  idioma: "__todos__",
  formato: "__todos__",
  minAds: "0",
  minDias: "0",
  ordem: "nota",
};

const OPCOES_ORDEM: { value: Ordem; label: string }[] = [
  { value: "nota", label: "Melhores ofertas (nota)" },
  { value: "ads", label: "Quantidade de anúncios" },
  { value: "dias", label: "Tempo em análise" },
  { value: "estab", label: "Estabilidade" },
  { value: "recente", label: "Última leitura" },
  { value: "nome", label: "Nome" },
];

// Idêntico a `linkSeguro` do original (index.html:631-637) — nunca renderiza href de protocolo
// perigoso (javascript:, data:, etc.), só http(s).
function linkSeguro(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function valoresUnicos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "pt"));
}

// Idêntico a `ordemLeitura` do original — usado só pra comparar "última leitura" no ordenar por
// "recente" (mesma chave que avaliacao.mjs usa pra ordenar a série).
function ordemDaUltima(leitura: SpyLeitura | null): string {
  if (!leitura) return "";
  return leitura.data + (leitura.periodo === "manha" ? "A" : "B");
}

type Avaliacao = ReturnType<typeof avaliarTodasOfertas>[string];

const COMPARADORES: Record<Ordem, (a: SpyOferta, b: SpyOferta, mapa: Record<string, Avaliacao>) => number> = {
  nota: (a, b, mapa) => mapa[b.id].nota - mapa[a.id].nota,
  ads: (a, b, mapa) => mapa[b.id].atual - mapa[a.id].atual,
  dias: (a, b, mapa) => mapa[b.id].dias - mapa[a.id].dias,
  estab: (a, b, mapa) => mapa[b.id].estab - mapa[a.id].estab,
  nome: (a, b) => a.nome.localeCompare(b.nome, "pt"),
  recente: (a, b, mapa) => (ordemDaUltima(mapa[b.id].ultima) < ordemDaUltima(mapa[a.id].ultima) ? -1 : 1),
};

// Idêntico a `filtradas` do original (index.html:756-787).
function filtrarEOrdenar(ofertas: SpyOferta[], mapa: Record<string, Avaliacao>, filtros: Filtros): SpyOferta[] {
  const minAds = Number(filtros.minAds) || 0;
  const minDias = Number(filtros.minDias) || 0;
  const lista = ofertas.filter((o) => {
    const a = mapa[o.id];
    if (filtros.oferta !== "__todas__" && o.id !== filtros.oferta) return false;
    if (filtros.nicho !== "__todos__" && o.nicho !== filtros.nicho) return false;
    if (filtros.idioma !== "__todos__" && o.idioma !== filtros.idioma) return false;
    if (filtros.formato !== "__todos__" && (o.formato ?? "") !== filtros.formato) return false;
    if (a.atual < minAds) return false;
    if (a.dias < minDias) return false;
    return true;
  });
  return [...lista].sort((a, b) => COMPARADORES[filtros.ordem](a, b, mapa));
}

const VARIANTE_SITUACAO: Record<string, StatusBadgeProps["variant"]> = {
  pouco: "neutral",
  morrendo: "danger",
  caindo: "warning",
  subindo: "success",
  estavel: "info",
};

const VARIANTE_VEREDITO: Record<string, StatusBadgeProps["variant"]> = {
  neutro: "neutral",
  sucesso: "success",
  info: "info",
  alerta: "warning",
  perigo: "danger",
};

const TEXTO_COR_VEREDITO: Record<string, string> = {
  neutro: "text-muted-foreground",
  sucesso: "text-success",
  info: "text-info",
  alerta: "text-warning",
  perigo: "text-danger",
};

// Mini-histórico de leituras por barra (equivalente visual da `faixa()` SVG do original,
// index.html:730-751): uma barra por leitura, altura proporcional ao pico da série, cor por
// período, opacidade reduzida nos dias fora de escala, última leitura sempre em opacidade cheia.
function FaixaLeituras({ avaliacao }: { avaliacao: Avaliacao }) {
  const serie = avaliacao.serie as SpyLeitura[];
  if (!serie.length) {
    return <p className="text-xs text-muted-foreground">sem leituras</p>;
  }
  const max = Math.max(...serie.map((l) => l.ads), 1);
  return (
    <div className="flex h-10 items-end gap-0.5" role="img" aria-label="histórico de leituras">
      {serie.map((l, i) => {
        const alturaPct = Math.max(6, (l.ads / max) * 100);
        const perdeu = avaliacao.foraEscala.has(l.data);
        const ultima = i === serie.length - 1;
        return (
          <div
            key={`${l.data}-${l.periodo}`}
            title={`${formatDate(l.data)} ${formatPeriodo(l.periodo)} — ${formatCount(l.ads)} anúncios${perdeu ? " · fora de escala" : ""}`}
            className={`w-1.5 rounded-t-sm ${l.periodo === "manha" ? "bg-chart-3" : "bg-chart-1"} ${
              ultima ? "opacity-100" : perdeu ? "opacity-35" : "opacity-70"
            } ${perdeu ? "border-b-2 border-danger" : ""}`}
            style={{ height: `${alturaPct}%` }}
          />
        );
      })}
    </div>
  );
}

// Barra segmentada de estabilidade/volume/tempo — idêntico ao cálculo de largura do original
// (index.html:814-815: `val*peso/soma` por segmento).
function BarraNota({ avaliacao, pesos }: { avaliacao: Avaliacao; pesos: SpyModuleEstadoData["pesos"] }) {
  const soma = pesos.estab + pesos.vol + pesos.tempo || 1;
  const segmentos = [
    { valor: avaliacao.estab, peso: pesos.estab, cor: "bg-chart-1" },
    { valor: avaliacao.vol, peso: pesos.vol, cor: "bg-chart-3" },
    { valor: avaliacao.tempo, peso: pesos.tempo, cor: "bg-chart-2" },
  ];
  return (
    <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-muted">
      {segmentos.map((s, i) => (
        <div key={i} className={s.cor} style={{ width: `${((s.valor * s.peso) / soma).toFixed(1)}%` }} />
      ))}
    </div>
  );
}

export function PainelPanel({ data }: { data: SpyModuleEstadoData }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);

  const mapa = useMemo(
    () => avaliarTodasOfertas(data.ofertas, data.leituras, data.pesos, data.tolerancia),
    [data.ofertas, data.leituras, data.pesos, data.tolerancia],
  );

  const nichos = useMemo(() => valoresUnicos(data.ofertas.map((o) => o.nicho)), [data.ofertas]);
  const idiomas = useMemo(() => valoresUnicos(data.ofertas.map((o) => o.idioma)), [data.ofertas]);
  const formatos = useMemo(() => valoresUnicos(data.ofertas.map((o) => o.formato)), [data.ofertas]);

  const lista = useMemo(() => filtrarEOrdenar(data.ofertas, mapa, filtros), [data.ofertas, mapa, filtros]);

  // KPIs seguem o filtro ativo — igual ao original, onde `renderPainel()` recalcula os 4 KPIs a
  // partir da MESMA `lista` filtrada usada no ranking (index.html:794-803).
  const resumo = resumoOfertas(lista, mapa);
  const liderAvaliacao = resumo.lider ? mapa[resumo.lider.id] : null;
  const porNota = filtros.ordem === "nota";

  function atualizar<K extends keyof Filtros>(campo: K, valor: Filtros[K]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Filtros</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Oferta
            <Select value={filtros.oferta} onValueChange={(v) => atualizar("oferta", v ?? FILTROS_PADRAO.oferta)}>
              <SelectTrigger className="w-44"><SelectValue>{(v: string) => (v === "__todas__" ? "todas as ofertas" : data.ofertas.find((o) => o.id === v)?.nome ?? v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">todas as ofertas</SelectItem>
                {data.ofertas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nicho
            <Select value={filtros.nicho} onValueChange={(v) => atualizar("nicho", v ?? FILTROS_PADRAO.nicho)}>
              <SelectTrigger className="w-36"><SelectValue>{(v: string) => (v === "__todos__" ? "todos" : v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">todos</SelectItem>
                {nichos.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Idioma
            <Select value={filtros.idioma} onValueChange={(v) => atualizar("idioma", v ?? FILTROS_PADRAO.idioma)}>
              <SelectTrigger className="w-36"><SelectValue>{(v: string) => (v === "__todos__" ? "todos" : v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">todos</SelectItem>
                {idiomas.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Formato
            <Select value={filtros.formato} onValueChange={(v) => atualizar("formato", v ?? FILTROS_PADRAO.formato)}>
              <SelectTrigger className="w-36"><SelectValue>{(v: string) => (v === "__todos__" ? "todos" : v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">todos</SelectItem>
                {formatos.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mín. anúncios
            <Input
              type="number"
              min={0}
              className="w-24"
              value={filtros.minAds}
              onChange={(e) => atualizar("minAds", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mín. dias
            <Input
              type="number"
              min={0}
              className="w-24"
              value={filtros.minDias}
              onChange={(e) => atualizar("minDias", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ordenar por
            <Select value={filtros.ordem} onValueChange={(v) => atualizar("ordem", (v ?? FILTROS_PADRAO.ordem) as Ordem)}>
              <SelectTrigger className="w-52"><SelectValue>{(v: string) => OPCOES_ORDEM.find((o) => o.value === v)?.label ?? v}</SelectValue></SelectTrigger>
              <SelectContent>
                {OPCOES_ORDEM.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => setFiltros(FILTROS_PADRAO)}>
            Limpar
          </Button>
        </div>
      </div>

      <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do Painel">
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

      {data.ofertas.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma oferta em vigília.</div>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nada bate com esses filtros — afrouxe o mínimo de anúncios ou de dias.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((oferta, i) => {
            const a = mapa[oferta.id];
            const sit = situacaoOferta(a);
            const ver = veredictoDaNota(a.nota, a.pouco);
            const href = linkSeguro(oferta.link);
            const cls = a.delta > 0 ? "text-success" : a.delta < 0 ? "text-danger" : "text-muted-foreground";
            const ultimoTexto = a.ultima ? `${formatDate(a.ultima.data)} · ${formatPeriodo(a.ultima.periodo)}` : "sem leitura";

            return (
              <article
                key={oferta.id}
                className={`grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[2rem_1fr_10rem_6rem_9rem] sm:items-center ${
                  i === 0 && porNota ? "border-primary/50 ring-1 ring-primary/20" : ""
                }`}
              >
                <div className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        {oferta.nome}
                      </a>
                    ) : (
                      oferta.nome
                    )}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge variant={VARIANTE_SITUACAO[sit.classe]}>{sit.txt}</StatusBadge>
                    {oferta.formato ? <StatusBadge variant="neutral">{oferta.formato}</StatusBadge> : null}
                    {oferta.nicho ? <StatusBadge variant="neutral">{oferta.nicho}</StatusBadge> : null}
                    {oferta.idioma ? <StatusBadge variant="neutral">{oferta.idioma}</StatusBadge> : null}
                    <span className="text-[11px] text-muted-foreground" title="dias dentro da tolerância">
                      {a.emEscala}/{a.diasReg} dias em escala
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.dias} {a.dias === 1 ? "dia" : "dias"} · {a.n} leituras
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <FaixaLeituras avaliacao={a} />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{a.serie.length ? formatDate((a.serie[0] as SpyLeitura).data) : ""}</span>
                    <span>{ultimoTexto}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-lg font-semibold tabular-nums">{formatCount(a.atual)}</p>
                  <p className="text-[11px] text-muted-foreground">ads ativos</p>
                  <p className={`text-[11px] font-medium ${cls}`}>{a.delta > 0 ? "+" : ""}{a.delta} desde a anterior</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className={`font-mono text-xl font-semibold tabular-nums ${TEXTO_COR_VEREDITO[ver.tom]}`}>{a.nota}</p>
                  <BarraNota avaliacao={a} pesos={data.pesos} />
                  <p className="text-[10px] text-muted-foreground" title="estabilidade / volume / tempo">
                    {a.estab} · {a.vol} · {a.tempo}
                  </p>
                  <StatusBadge variant={VARIANTE_VEREDITO[ver.tom]}>{ver.txt}</StatusBadge>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
