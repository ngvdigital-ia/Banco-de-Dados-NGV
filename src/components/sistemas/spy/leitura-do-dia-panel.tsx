"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salvarSpyLeiturasLoteAction } from "@/app/(dashboard)/sistemas/spy/actions";
import { formatCount, formatDate } from "./format";
import {
  calcularMovimento,
  leituraAnterior,
  leituraCompletaParaTodas,
  leituraExistente,
  montarItensLote,
  repetirContagensAnteriores,
} from "./leitura-logic.mjs";
import { descreverErroMutacaoSpy } from "./mutation-messages.mjs";
import type { SpyModuleEstadoData } from "./types";

// Aba "Leitura do dia" — porta fiel de workspaces/spy-analytics/index.html (marcação :355-370,
// render :862-895, salvar :1455-1470). A MAIS usada do módulo: o operador digita a contagem de
// anúncios de cada oferta duas vezes por dia. Toda escrita passa por
// `salvarSpyLeiturasLoteAction` (src/app/(dashboard)/sistemas/spy/actions.ts) -> mutations.ts ->
// requireModuleAccess + logModuleAction — nunca pelo mutations-client.mjs direto.

function hojeISO(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function periodoInicial(): "manha" | "noite" {
  return new Date().getHours() < 14 ? "manha" : "noite";
}

function valoresIniciais(
  ofertas: SpyModuleEstadoData["ofertas"],
  leituras: SpyModuleEstadoData["leituras"],
  data: string,
  periodo: "manha" | "noite",
): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const oferta of ofertas) {
    const existente = leituraExistente(leituras, oferta.id, data, periodo);
    if (existente) valores[oferta.id] = String(existente.ads);
  }
  return valores;
}

export function LeituraDoDiaPanel({ data, mutationsEnabled }: { data: SpyModuleEstadoData; mutationsEnabled: boolean }) {
  if (!mutationsEnabled) return null;
  return <LeituraDoDiaMutablePanel data={data} />;
}

function LeituraDoDiaMutablePanel({ data }: { data: SpyModuleEstadoData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dataLeitura, setDataLeitura] = useState(hojeISO());
  const [periodo, setPeriodo] = useState<"manha" | "noite">(periodoInicial());
  const [valores, setValores] = useState<Record<string, string>>(() =>
    valoresIniciais(data.ofertas, data.leituras, hojeISO(), periodoInicial()),
  );

  function trocarDataOuPeriodo(novaData: string, novoPeriodo: "manha" | "noite") {
    setDataLeitura(novaData);
    setPeriodo(novoPeriodo);
    setValores(valoresIniciais(data.ofertas, data.leituras, novaData, novoPeriodo));
  }

  const aviso = useMemo(
    () => leituraCompletaParaTodas(data.ofertas, data.leituras, dataLeitura, periodo),
    [data.ofertas, data.leituras, dataLeitura, periodo],
  );

  function repetirAnteriores() {
    const preenchidas = repetirContagensAnteriores(data.ofertas, data.leituras, dataLeitura, periodo);
    setValores((atual) => ({ ...atual, ...preenchidas }));
    toast.info("Contagens anteriores preenchidas. Ajuste o que mudou e salve.");
  }

  function salvar() {
    if (!dataLeitura) {
      toast.error("Escolha a data da leitura.");
      return;
    }
    const itens = montarItensLote({
      ofertas: data.ofertas,
      leituras: data.leituras,
      data: dataLeitura,
      periodo,
      valores,
      gerarId: () => crypto.randomUUID(),
    });
    if (itens.length === 0) {
      toast.error("Nenhuma contagem preenchida.");
      return;
    }
    startTransition(async () => {
      const result = await salvarSpyLeiturasLoteAction(itens);
      if (result.kind === "success") {
        toast.success(
          `${itens.length} ${itens.length === 1 ? "contagem gravada" : "contagens gravadas"} em ${formatDate(dataLeitura)}.`,
        );
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`${erro.titulo}: ${erro.detalhe}`);
    });
  }

  if (data.ofertas.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Cadastre uma oferta primeiro — sem oferta na lista não há o que contar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Registrar leitura</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Uma leitura de manhã e uma de noite. Digite só a quantidade de anúncios ativos de cada oferta — campo em
          branco não grava nada. A coluna &ldquo;anterior&rdquo; mostra a última contagem registrada.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Data
            <Input
              type="date"
              className="w-40"
              value={dataLeitura}
              onChange={(e) => trocarDataOuPeriodo(e.target.value, periodo)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Período
            <Select value={periodo} onValueChange={(v) => trocarDataOuPeriodo(dataLeitura, (v as "manha" | "noite") ?? periodo)}>
              <SelectTrigger className="w-32"><SelectValue>{(v: string) => (v === "noite" ? "Noite" : "Manhã")}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã</SelectItem>
                <SelectItem value="noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <Button type="button" onClick={salvar} disabled={pending}>
            {pending ? "Salvando…" : "Salvar leitura"}
          </Button>
          <Button type="button" variant="outline" onClick={repetirAnteriores} disabled={pending}>
            Repetir contagens anteriores
          </Button>
        </div>
        {aviso ? (
          <p className="mt-3 rounded-md bg-info-muted px-3 py-2 text-xs text-info">
            Leitura de {formatDate(dataLeitura)} ({periodo === "manha" ? "manhã" : "noite"}) já registrada para todas
            as ofertas. Salvar de novo sobrescreve.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[1fr_9rem_8rem_10rem] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Oferta</span>
          <span>Anúncios ativos</span>
          <span>Anterior</span>
          <span>Movimento</span>
        </div>
        <div className="divide-y">
          {data.ofertas.map((oferta) => {
            const anterior = leituraAnterior(data.leituras, oferta.id, dataLeitura, periodo);
            const valorAtual = valores[oferta.id] ?? "";
            const movimento = calcularMovimento(valorAtual, anterior?.ads ?? null);
            const corMovimento =
              movimento === null
                ? "text-muted-foreground"
                : movimento.delta > 0
                  ? "text-success"
                  : movimento.delta < 0
                    ? "text-danger"
                    : "text-muted-foreground";
            return (
              <div key={oferta.id} className="grid grid-cols-[1fr_9rem_8rem_10rem] items-center gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{oferta.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {oferta.formato ?? "—"} · {oferta.idioma ?? "—"} · {oferta.nicho ?? "—"}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={valorAtual}
                  onChange={(e) => setValores((atual) => ({ ...atual, [oferta.id]: e.target.value }))}
                  disabled={pending}
                />
                <span className="text-sm text-muted-foreground">
                  {anterior ? (
                    <>
                      {formatCount(anterior.ads)} <span className="text-[11px]">{formatDate(anterior.data)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className={`text-sm font-medium ${corMovimento}`}>
                  {movimento === null
                    ? "—"
                    : `${movimento.delta > 0 ? "+" : ""}${movimento.delta} (${movimento.pct > 0 ? "+" : ""}${movimento.pct}%)`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
