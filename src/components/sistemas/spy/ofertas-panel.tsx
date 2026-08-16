"use client";

import { useState, useTransition } from "react";
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
import { criarSpyOfertaAction, editarSpyOfertaAction, removerSpyOfertaAction } from "@/app/(dashboard)/sistemas/spy/actions";
import {
  construirInputCriacao,
  construirPatchEdicao,
  formularioDaOferta,
  formularioVazio,
  nomeDuplicado,
  patchVazio,
  type OfertaFormValues,
} from "./ofertas-logic.mjs";
import { descreverErroMutacaoSpy } from "./mutation-messages.mjs";
import type { SpyModuleEstadoData, SpyOferta } from "./types";

// Aba "Ofertas" — porta fiel de workspaces/spy-analytics/index.html (marcação :372-406, render
// :900-948, ações :922-931 e :1472-1496). Cadastro/edição de ofertas + lista com editar/remover.
// Toda escrita passa por src/app/(dashboard)/sistemas/spy/actions.ts -> mutations.ts.

const FORMATOS = ["VSL", "Quiz", "Página de vendas", "Advertorial", "Outro"];

export function OfertasPanel({ data }: { data: SpyModuleEstadoData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<OfertaFormValues>(formularioVazio());

  function campo<K extends keyof OfertaFormValues>(chave: K, valor: OfertaFormValues[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function limparForm() {
    setEditandoId(null);
    setForm(formularioVazio());
  }

  function iniciarEdicao(oferta: SpyOferta) {
    setEditandoId(oferta.id);
    setForm(formularioDaOferta(oferta));
  }

  function salvar() {
    const nome = form.nome.trim();
    if (!nome) {
      toast.error("A oferta precisa de um nome.");
      return;
    }

    if (editandoId) {
      const original = data.ofertas.find((o) => o.id === editandoId);
      if (!original) {
        toast.error("Esta oferta não está mais na lista — recarregue a página.");
        return;
      }
      if (nomeDuplicado(data.ofertas, nome, editandoId)) {
        toast.error("Já existe uma oferta com esse nome.");
        return;
      }
      const patch = construirPatchEdicao(original, form);
      if (patchVazio(patch)) {
        // Nada mudou — não dispara PATCH nem gera linha de auditoria por um "salvar" vazio.
        toast.info("Nada mudou nesta oferta.");
        limparForm();
        return;
      }
      startTransition(async () => {
        const result = await editarSpyOfertaAction(editandoId, patch);
        if (result.kind === "success") {
          toast.success("Oferta atualizada.");
          limparForm();
          router.refresh();
          return;
        }
        const erro = descreverErroMutacaoSpy(result);
        toast.error(`${erro.titulo}: ${erro.detalhe}`);
      });
      return;
    }

    if (nomeDuplicado(data.ofertas, nome, null)) {
      toast.error("Já existe uma oferta com esse nome.");
      return;
    }
    const input = construirInputCriacao(form, () => crypto.randomUUID());
    startTransition(async () => {
      const result = await criarSpyOfertaAction(input);
      if (result.kind === "success") {
        toast.success(`"${nome}" entrou na vigília.`);
        limparForm();
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`${erro.titulo}: ${erro.detalhe}`);
    });
  }

  function remover(oferta: SpyOferta) {
    if (!window.confirm(`Remover "${oferta.nome}" e todas as suas leituras? Não dá para desfazer.`)) return;
    startTransition(async () => {
      const result = await removerSpyOfertaAction(oferta.id);
      if (result.kind === "success") {
        toast.success("Oferta removida.");
        if (editandoId === oferta.id) limparForm();
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`${erro.titulo}: ${erro.detalhe}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">{editandoId ? "Editar oferta" : "Cadastrar oferta"}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nome
            <Input className="w-52" placeholder="ex.: Mestre da Cama" value={form.nome} onChange={(e) => campo("nome", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Formato
            <Select value={form.formato || "__nenhum__"} onValueChange={(v) => campo("formato", v === "__nenhum__" ? "" : (v ?? ""))}>
              <SelectTrigger className="w-40"><SelectValue>{(v: string) => (v === "__nenhum__" ? "—" : v)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">—</SelectItem>
                {FORMATOS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nicho
            <Input className="w-40" placeholder="ex.: saúde masculina" value={form.nicho} onChange={(e) => campo("nicho", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Idioma
            <Input className="w-32" placeholder="ex.: alemão" value={form.idioma} onChange={(e) => campo("idioma", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Cloaker
            <Select value={form.cloaker || "__nenhum__"} onValueChange={(v) => campo("cloaker", v === "__nenhum__" ? "" : (v ?? ""))}>
              <SelectTrigger className="w-28"><SelectValue>{(v: string) => ({ __nenhum__: "—", sim: "Sim", nao: "Não", talvez: "Talvez" })[v] ?? v}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">—</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="talvez">Talvez</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Tipo do produto
            <Select value={form.tipoProduto || "__nenhum__"} onValueChange={(v) => campo("tipoProduto", v === "__nenhum__" ? "" : (v ?? ""))}>
              <SelectTrigger className="w-44"><SelectValue>{(v: string) => ({ __nenhum__: "—", infoproduto: "Infoproduto", nao_identificado: "Não identificado" })[v] ?? v}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">—</SelectItem>
                <SelectItem value="infoproduto">Infoproduto</SelectItem>
                <SelectItem value="nao_identificado">Não identificado</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Link
            <Input className="w-56" placeholder="página de vendas ou biblioteca de anúncios" value={form.link} onChange={(e) => campo("link", e.target.value)} />
          </label>
          <Button type="button" onClick={salvar} disabled={pending}>
            {pending ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar"}
          </Button>
          {editandoId ? (
            <Button type="button" variant="outline" onClick={limparForm} disabled={pending}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {data.ofertas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Lista vazia — adicione a primeira oferta acima.</p>
        ) : (
          <div className="divide-y">
            {data.ofertas.map((oferta) => {
              const n = data.leituras.filter((l) => l.ofertaId === oferta.id).length;
              return (
                <div
                  key={oferta.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 ${oferta.id === editandoId ? "bg-muted/40" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{oferta.nome}</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                      {oferta.formato ?? "—"} · {oferta.nicho ?? "—"} · {oferta.idioma ?? "—"} · {n}{" "}
                      {n === 1 ? "leitura" : "leituras"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => iniciarEdicao(oferta)} disabled={pending}>
                      Editar
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => remover(oferta)} disabled={pending}>
                      Remover
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
