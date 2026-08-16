"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import {
  atualizarSpyConfigAction,
  criarSpyOfertaAction,
  editarSpyLeituraAction,
  editarSpyOfertaAction,
  removerSpyLeituraAction,
  removerSpyOfertaAction,
  salvarSpyLeiturasLoteAction,
} from "@/app/(dashboard)/sistemas/spy/actions";
import {
  confirmacaoApagarTudoValida,
  executarApagarTudoSeConfirmado,
  PALAVRA_CONFIRMACAO_APAGAR_TUDO,
} from "./apagar-tudo-logic.mjs";
import { criarDebounce } from "./debounce.mjs";
import { formatCount, formatDate, formatPeriodo, formatTolerance } from "./format";
import { backupValido, construirCsv, parseImportacao } from "./importacao-logic.mjs";
import { descreverErroMutacaoSpy } from "./mutation-messages.mjs";
import type { SpyModuleEstadoData, SpyPesos } from "./types";

// Aba "Dados e critérios" — porta de workspaces/spy-analytics/index.html:441-490. Quatro blocos:
// (1) pesos + tolerância com debounce ~500ms (index.html:1516-1529), (2) importar planilha
// colada / exportar CSV / backup JSON / restaurar / "Apagar tudo" (index.html:459-472,
// 1546-1704), (3) corrigir/remover leitura individual (index.html:476-482, 953-984), (4) texto
// explicativo (index.html:484-489).

const PADRAO_PESOS: SpyPesos = { estab: 45, vol: 30, tempo: 25 };
const PADRAO_TOLERANCIA = 20;
// Mesmo valor do original (index.html:1516-1520) — cada pixel arrastado no slider dispara
// onChange; sem debounce vira uma chamada de rede (e uma linha de auditoria) por pixel.
const DEBOUNCE_CONFIG_MS = 500;

function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export function DadosCriteriosPanel({ data }: { data: SpyModuleEstadoData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // --- Bloco 1: pesos + tolerância ---
  const [pesos, setPesos] = useState<SpyPesos>(data.pesos);
  const [tolerancia, setTolerancia] = useState(data.tolerancia);

  function salvarConfig(novosPesos: SpyPesos, novaTolerancia: number) {
    startTransition(async () => {
      const result = await atualizarSpyConfigAction(novosPesos, novaTolerancia);
      if (result.kind === "success") {
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`Critérios não gravados no servidor — ${erro.titulo}: ${erro.detalhe}`);
    });
  }

  // Debounce ~500ms (kiss: um debounce só, recriado se pending mudar de identidade não importa —
  // criarDebounce fecha sobre `salvarConfig` estável por closure do módulo, não por estado). Ver
  // src/components/sistemas/spy/debounce.mjs e tests/sistemas-spy-debounce.test.mjs.
  const salvarConfigDebounced = useMemo(
    () => criarDebounce((p: SpyPesos, t: number) => salvarConfig(p, t), DEBOUNCE_CONFIG_MS),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- criarDebounce precisa ser criado 1x; salvarConfig é estável o bastante (só fecha sobre startTransition/router, ambos estáveis entre renders)
    [],
  );

  function mudarPeso(chave: keyof SpyPesos, valor: number) {
    const novos = { ...pesos, [chave]: valor };
    setPesos(novos);
    salvarConfigDebounced(novos, tolerancia);
  }

  function mudarTolerancia(valor: number) {
    setTolerancia(valor);
    salvarConfigDebounced(pesos, valor);
  }

  function voltarPadrao() {
    setPesos(PADRAO_PESOS);
    setTolerancia(PADRAO_TOLERANCIA);
    salvarConfigDebounced.cancel();
    salvarConfig(PADRAO_PESOS, PADRAO_TOLERANCIA);
    toast.success("Critérios voltaram ao padrão.");
  }

  // --- Bloco 2: importar / exportar / restaurar / apagar tudo ---
  const [textoImportar, setTextoImportar] = useState("");
  const [avisoImport, setAvisoImport] = useState<string | null>(null);
  const arquivoBackupRef = useRef<HTMLInputElement>(null);
  const [textoConfirmaApagar, setTextoConfirmaApagar] = useState("");

  function importar() {
    const texto = textoImportar.trim();
    if (!texto) {
      setAvisoImport("Cole as linhas antes de importar.");
      return;
    }
    const resultado = parseImportacao(texto, data.ofertas, data.leituras, () => crypto.randomUUID());
    startTransition(async () => {
      for (const oferta of resultado.ofertasNovas) {
        const r = await criarSpyOfertaAction({
          id: oferta.id,
          nome: oferta.nome,
          formato: oferta.formato || null,
          nicho: oferta.nicho || null,
          idioma: oferta.idioma || null,
          link: oferta.link || null,
        });
        if (r.kind !== "success") {
          const erro = descreverErroMutacaoSpy(r);
          setAvisoImport(`Parou em "${oferta.nome}" — ${erro.titulo}: ${erro.detalhe}. Nada depois desta linha foi enviado.`);
          return;
        }
      }
      for (const editada of resultado.ofertasEditadas) {
        const original = data.ofertas.find((o) => o.id === editada.id);
        if (!original) continue;
        const patch: Record<string, string> = {};
        if (editada.nicho && editada.nicho !== (original.nicho ?? "")) patch.nicho = editada.nicho;
        if (editada.idioma && editada.idioma !== (original.idioma ?? "")) patch.idioma = editada.idioma;
        if (editada.formato && editada.formato !== (original.formato ?? "")) patch.formato = editada.formato;
        if (Object.keys(patch).length === 0) continue;
        await editarSpyOfertaAction(editada.id, patch);
      }
      if (resultado.leiturasTocadas.length) {
        const r = await salvarSpyLeiturasLoteAction(resultado.leiturasTocadas);
        if (r.kind !== "success") {
          const erro = descreverErroMutacaoSpy(r);
          setAvisoImport(`Ofertas entraram, mas as leituras não: ${erro.titulo}: ${erro.detalhe}.`);
          return;
        }
      }
      setAvisoImport(
        `${resultado.ofertasNovas.length} ofertas criadas · ${resultado.leiturasTocadas.length} leituras gravadas · ${resultado.ofertasEditadas.length} ofertas atualizadas${resultado.ignoradas ? ` · ${resultado.ignoradas} linhas ignoradas` : ""}.`,
      );
      setTextoImportar("");
      toast.success("Importação concluída.");
      router.refresh();
    });
  }

  function exportarCsv() {
    const csv = construirCsv(data.ofertas, data.leituras);
    baixarArquivo(`spy-analytics-${hojeISO()}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("CSV baixado.");
  }

  function exportarBackup() {
    baixarArquivo(
      `spy-analytics-backup-${hojeISO()}.json`,
      JSON.stringify({ ofertas: data.ofertas, leituras: data.leituras, pesos: data.pesos, tolerancia: data.tolerancia }, null, 2),
      "application/json",
    );
    toast.success("Backup baixado.");
  }

  function restaurarBackup(arquivo: File) {
    const leitor = new FileReader();
    leitor.onload = () => {
      let backup: unknown;
      try {
        backup = JSON.parse(String(leitor.result));
      } catch {
        toast.error("Arquivo inválido. Use um backup gerado aqui.");
        return;
      }
      if (!backupValido(backup)) {
        toast.error("Arquivo inválido. Use um backup gerado aqui.");
        return;
      }
      const b = backup as { ofertas: { id: string; nome: string }[]; leituras: unknown[] };
      if (
        !window.confirm(
          `Restaurar ${b.ofertas.length} ofertas e ${b.leituras.length} leituras? Isso envia tudo pro servidor da equipe, somando ao que já existe.`,
        )
      ) {
        return;
      }
      // kiss: restauração roda sequencial e simples (sem chunking/retry item-a-item do original,
      // index.html:1646-1691) — backup do Spy é pequeno o bastante hoje pra isso não pesar; se
      // crescer, o ponto de entrada pra chunking é aqui.
      toast.info("Restaurando no servidor…");
      setAvisoImport(null);
      // Cast justificado (C10): `backup` já passou por `backupValido()` acima (checa
      // Array.isArray de ofertas/leituras em runtime) — só falta dizer ao TS o shape completo,
      // que `unknown` não carrega.
      restaurarNoServidor(backup as Parameters<typeof restaurarNoServidor>[0]);
    };
    leitor.readAsText(arquivo);
  }

  function restaurarNoServidor(backup: {
    ofertas: { id: string; nome: string; formato?: string | null; nicho?: string | null; idioma?: string | null; link?: string | null }[];
    leituras: { id: string; ofertaId: string; data: string; periodo: "manha" | "noite"; ads: number }[];
    pesos?: SpyPesos;
    tolerancia?: number;
  }) {
    startTransition(async () => {
      let ofertasFalhas = 0;
      for (const o of backup.ofertas) {
        const r = await criarSpyOfertaAction({
          id: o.id,
          nome: o.nome,
          formato: o.formato ?? null,
          nicho: o.nicho ?? null,
          idioma: o.idioma ?? null,
          link: o.link ?? null,
        });
        if (r.kind !== "success") ofertasFalhas++;
      }
      let leiturasOk = 0;
      if (backup.leituras.length) {
        const r = await salvarSpyLeiturasLoteAction(backup.leituras);
        if (r.kind === "success") leiturasOk = backup.leituras.length;
      }
      const rConfig = await atualizarSpyConfigAction(backup.pesos ?? PADRAO_PESOS, backup.tolerancia ?? PADRAO_TOLERANCIA);
      const tudoOk = ofertasFalhas === 0 && leiturasOk === backup.leituras.length && rConfig.kind === "success";
      if (tudoOk) {
        setAvisoImport(`Restauração concluída: ${backup.ofertas.length} ofertas · ${leiturasOk} leituras.`);
        toast.success("Sincronização do backup concluída.");
      } else {
        setAvisoImport(
          `Restauração incompleta — entrou: ${backup.ofertas.length - ofertasFalhas} ofertas, ${leiturasOk} leituras. Confira e tente restaurar o mesmo arquivo de novo.`,
        );
        toast.error("Restauração incompleta — veja o aviso abaixo.");
      }
      router.refresh();
    });
  }

  function apagarTudo() {
    const { disparado } = executarApagarTudoSeConfirmado(textoConfirmaApagar, () => {
      startTransition(async () => {
        let falhouAlguma = false;
        for (const oferta of data.ofertas) {
          const r = await removerSpyOfertaAction(oferta.id);
          if (r.kind !== "success") falhouAlguma = true;
        }
        const rConfig = await atualizarSpyConfigAction(PADRAO_PESOS, PADRAO_TOLERANCIA);
        if (rConfig.kind !== "success") falhouAlguma = true;
        setTextoConfirmaApagar("");
        if (falhouAlguma) {
          toast.error("Não deu para apagar tudo no servidor. Recarregue e confira o que sobrou.");
        } else {
          toast.success("Tudo apagado.");
          setPesos(PADRAO_PESOS);
          setTolerancia(PADRAO_TOLERANCIA);
        }
        router.refresh();
      });
    });
    if (!disparado) {
      toast.error(`Digite "${PALAVRA_CONFIRMACAO_APAGAR_TUDO}" pra habilitar. Nada foi apagado.`);
    }
  }

  // --- Bloco 3: corrigir leituras ---
  const [ofertaHistorico, setOfertaHistorico] = useState("");
  const leiturasDaOferta = useMemo(
    () =>
      data.leituras
        .filter((l) => l.ofertaId === ofertaHistorico)
        .slice()
        .sort((a, b) => (a.data + a.periodo < b.data + b.periodo ? 1 : -1)),
    [data.leituras, ofertaHistorico],
  );

  function corrigirLeitura(id: string, valorTexto: string, valorOriginal: number) {
    if (valorTexto === "") return;
    const numero = Number(valorTexto);
    if (!Number.isFinite(numero)) return;
    const ads = Math.max(0, Math.round(numero));
    if (ads === valorOriginal) return;
    startTransition(async () => {
      const result = await editarSpyLeituraAction(id, ads);
      if (result.kind === "success") {
        toast.success("Leitura corrigida.");
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`${erro.titulo}: ${erro.detalhe}`);
    });
  }

  function removerLeitura(id: string) {
    if (!window.confirm("Remover esta leitura?")) return;
    startTransition(async () => {
      const result = await removerSpyLeituraAction(id);
      if (result.kind === "success") {
        toast.success("Leitura removida.");
        router.refresh();
        return;
      }
      const erro = descreverErroMutacaoSpy(result);
      toast.error(`${erro.titulo}: ${erro.detalhe}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Peso de cada critério</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A nota final é a média ponderada dos três critérios. Mexer aqui recalcula o ranking na hora e fica salvo.
          </p>
          <div className="mt-4 space-y-3">
            {(
              [
                ["estab", "Estabilidade"],
                ["vol", "Quantidade de ads"],
                ["tempo", "Tempo em análise"],
              ] as const
            ).map(([chave, rotulo]) => (
              <div key={chave} className="flex items-center gap-3">
                <span className="w-40 text-xs text-muted-foreground">{rotulo}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pesos[chave]}
                  onChange={(e) => mudarPeso(chave, Number(e.target.value))}
                  className="h-1.5 flex-1 accent-primary"
                  disabled={pending}
                />
                <b className="w-10 text-right font-mono text-sm tabular-nums">{pesos[chave]}</b>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t pt-3">
              <span className="w-40 text-xs text-muted-foreground">Tolerância de queda</span>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={tolerancia}
                onChange={(e) => mudarTolerancia(Number(e.target.value))}
                className="h-1.5 flex-1 accent-primary"
                disabled={pending}
              />
              <b className="w-10 text-right font-mono text-sm tabular-nums">{formatTolerance(tolerancia)}</b>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            <b>Estabilidade</b> conta em quantos dias a oferta se manteve em escala — dentro da tolerância abaixo do
            maior nível já alcançado. <b>Tempo em análise</b> satura em torno de 21 dias. <b>Quantidade de ads</b>{" "}
            usa escala logarítmica contra a maior oferta do painel.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={voltarPadrao} disabled={pending}>
            Voltar ao padrão 45/30/25
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Importar do Google Docs / planilha</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cole as linhas no formato abaixo. Separador pode ser vírgula, ponto e vírgula ou tabulação. Oferta que
            ainda não existe é criada automaticamente; a coluna formato é opcional.
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">oferta ; nicho ; idioma ; formato ; data ; periodo ; anuncios</p>
          <textarea
            rows={5}
            className="mt-2 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Mestre da Cama;saúde masculina;alemão;VSL;28/07/2026;manha;180"
            value={textoImportar}
            onChange={(e) => setTextoImportar(e.target.value)}
            disabled={pending}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={importar} disabled={pending}>Importar</Button>
            <Button type="button" variant="outline" onClick={exportarCsv} disabled={pending}>Exportar CSV</Button>
            <Button type="button" variant="outline" onClick={exportarBackup} disabled={pending}>Baixar backup</Button>
            <Button type="button" variant="outline" onClick={() => arquivoBackupRef.current?.click()} disabled={pending}>
              Restaurar backup
            </Button>
            <input
              ref={arquivoBackupRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) restaurarBackup(arquivo);
              }}
            />
          </div>
          {avisoImport ? <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs">{avisoImport}</p> : null}

          <div className="mt-5 rounded-md border border-danger/40 bg-danger-muted p-3">
            <p className="text-xs font-semibold text-danger">Apagar tudo</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Remove TODAS as ofertas e leituras e redefine os critérios. Não dá para desfazer — destrói o histórico
              que sustenta o ranking. Fica registrado em seu nome. Digite{" "}
              <span className="font-mono font-semibold">{PALAVRA_CONFIRMACAO_APAGAR_TUDO}</span> pra habilitar.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                className="w-40"
                placeholder={PALAVRA_CONFIRMACAO_APAGAR_TUDO}
                value={textoConfirmaApagar}
                onChange={(e) => setTextoConfirmaApagar(e.target.value)}
                disabled={pending}
              />
              <Button
                type="button"
                variant="destructive"
                onClick={apagarTudo}
                disabled={pending || !confirmacaoApagarTudoValida(textoConfirmaApagar)}
              >
                Apagar tudo
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Corrigir leituras</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Errou uma contagem ou registrou no dia errado? Escolha a oferta, altere o número direto na lista ou remova
          a leitura. Tudo recalcula na hora.
        </p>
        <label className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          Oferta
          <Select value={ofertaHistorico || "__nenhuma__"} onValueChange={(v) => setOfertaHistorico(v === "__nenhuma__" ? "" : (v ?? ""))}>
            <SelectTrigger className="w-56">
              <SelectValue>{(v: string) => (v === "__nenhuma__" ? "selecione" : data.ofertas.find((o) => o.id === v)?.nome ?? v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__nenhuma__">selecione</SelectItem>
              {[...data.ofertas].sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {!ofertaHistorico ? (
          <p className="mt-4 p-6 text-center text-sm text-muted-foreground">Escolha uma oferta — as leituras dela aparecem aqui para edição.</p>
        ) : leiturasDaOferta.length === 0 ? (
          <p className="mt-4 p-6 text-center text-sm text-muted-foreground">Sem leituras — registre a primeira em Leitura do dia.</p>
        ) : (
          <div className="mt-3 divide-y">
            {leiturasDaOferta.map((l) => (
              <div key={l.id} className="grid grid-cols-[8rem_5rem_7rem_auto] items-center gap-3 py-2">
                <span className="text-sm">{formatDate(l.data)}</span>
                <span className="text-sm text-muted-foreground">{formatPeriodo(l.periodo)}</span>
                <Input
                  type="number"
                  min={0}
                  defaultValue={l.ads}
                  key={`${l.id}-${l.ads}`}
                  onBlur={(e) => corrigirLeitura(l.id, e.target.value, l.ads)}
                  disabled={pending}
                />
                <Button type="button" size="sm" variant="destructive" onClick={() => removerLeitura(l.id)} disabled={pending}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Como a nota é lida</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Acima de 75 a oferta está sustentando escala com volume e tempo suficientes para bancar uma tradução.
          Entre 60 e 75 é candidata forte, normalmente falta tempo de acompanhamento. Entre 45 e 60 vale seguir
          observando. Abaixo de 45 a oferta tentou escalar e recuou. Ofertas com menos de 4 leituras aparecem
          marcadas como <b>pouco dado</b> — a nota existe, mas ainda não decide nada.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Na faixa de leituras do Painel, o traço vermelho embaixo marca os dias em que a oferta saiu de escala.
          Emenda de traços vermelhos no fim da faixa é oferta caindo agora.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Os dados ficam gravados no servidor do Spy — toda a equipe com acesso vê a mesma vigília, de qualquer
          navegador. <b>Baixar backup</b> exporta uma cópia local em JSON; <b>Restaurar backup</b> envia esse
          arquivo de volta para o servidor. Total: {formatCount(data.ofertas.length)} ofertas ·{" "}
          {formatCount(data.leituras.length)} leituras.
        </p>
      </div>
    </div>
  );
}
