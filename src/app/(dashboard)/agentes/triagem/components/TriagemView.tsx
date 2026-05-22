"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { CandidatosTable } from "./CandidatosTable";
import { CandidatoDetailsSheet } from "./CandidatoDetailsSheet";
import type {
  CandidatoTriado,
  VagaTriagem,
  ClassificacaoTriagem,
} from "@/lib/agentes/triagem/client";

interface Props {
  initialCandidatos: CandidatoTriado[];
  initialAtualizadoEm: string;
}

type FiltroVaga = VagaTriagem | "todas";
type FiltroClassif = ClassificacaoTriagem | "todas";

export function TriagemView({ initialCandidatos }: Props) {
  const [candidatos, setCandidatos] = useState(initialCandidatos);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filtroVaga, setFiltroVaga] = useState<FiltroVaga>("todas");
  const [filtroClassif, setFiltroClassif] = useState<FiltroClassif>("todas");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<CandidatoTriado | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/agentes/candidatos", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCandidatos(data.candidatos);
      toast.success(`${data.candidatos.length} candidatos atualizados`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.error(`Falha: ${msg}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      if (filtroVaga !== "todas" && c.vaga !== filtroVaga) return false;
      if (filtroClassif !== "todas" && c.classificacao !== filtroClassif)
        return false;
      if (
        busca &&
        !c.nome.toLowerCase().includes(busca.toLowerCase()) &&
        !c.email?.toLowerCase().includes(busca.toLowerCase())
      )
        return false;
      return true;
    });
  }, [candidatos, filtroVaga, filtroClassif, busca]);

  const contadoresVaga = useMemo(
    () => ({
      editor: candidatos.filter((c) => c.vaga === "editor").length,
      copywriter: candidatos.filter((c) => c.vaga === "copywriter").length,
      trafego: candidatos.filter((c) => c.vaga === "trafego").length,
    }),
    [candidatos],
  );

  const contadoresClassif = useMemo(
    () => ({
      MUITO_BOM: candidatos.filter((c) => c.classificacao === "MUITO_BOM")
        .length,
      TALVEZ: candidatos.filter((c) => c.classificacao === "TALVEZ").length,
      DESCARTAR: candidatos.filter((c) => c.classificacao === "DESCARTAR")
        .length,
    }),
    [candidatos],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agentes">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              Agentes
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Triagem</h1>
            <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 text-[11px] font-mono font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {candidatos.length} candidatos
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-medium"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>
      </header>

      <div className="bg-card border rounded-md p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Classificação:
          </span>
          <FiltroChip
            ativo={filtroClassif === "todas"}
            onClick={() => setFiltroClassif("todas")}
          >
            Todas ({candidatos.length})
          </FiltroChip>
          <FiltroChip
            ativo={filtroClassif === "MUITO_BOM"}
            cor="green"
            onClick={() => setFiltroClassif("MUITO_BOM")}
          >
            Muito bom ({contadoresClassif.MUITO_BOM})
          </FiltroChip>
          <FiltroChip
            ativo={filtroClassif === "TALVEZ"}
            cor="amber"
            onClick={() => setFiltroClassif("TALVEZ")}
          >
            Talvez ({contadoresClassif.TALVEZ})
          </FiltroChip>
          <FiltroChip
            ativo={filtroClassif === "DESCARTAR"}
            cor="slate"
            onClick={() => setFiltroClassif("DESCARTAR")}
          >
            Descartar ({contadoresClassif.DESCARTAR})
          </FiltroChip>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Vaga:
          </span>
          <FiltroChip
            ativo={filtroVaga === "todas"}
            onClick={() => setFiltroVaga("todas")}
          >
            Todas
          </FiltroChip>
          <FiltroChip
            ativo={filtroVaga === "editor"}
            onClick={() => setFiltroVaga("editor")}
          >
            Editor ({contadoresVaga.editor})
          </FiltroChip>
          <FiltroChip
            ativo={filtroVaga === "copywriter"}
            onClick={() => setFiltroVaga("copywriter")}
          >
            Copywriter ({contadoresVaga.copywriter})
          </FiltroChip>
          <FiltroChip
            ativo={filtroVaga === "trafego"}
            onClick={() => setFiltroVaga("trafego")}
          >
            Tráfego ({contadoresVaga.trafego})
          </FiltroChip>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border rounded-md outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
        </div>
      </div>

      <CandidatosTable
        candidatos={filtrados}
        totalSemFiltro={candidatos.length}
        onSelecionar={setSelecionado}
      />
      <CandidatoDetailsSheet
        candidato={selecionado}
        onClose={() => setSelecionado(null)}
      />
    </div>
  );
}

interface FiltroChipProps {
  ativo: boolean;
  cor?: "green" | "amber" | "slate";
  onClick: () => void;
  children: React.ReactNode;
}

function FiltroChip({ ativo, cor, onClick, children }: FiltroChipProps) {
  const corClasses = ativo
    ? cor === "green"
      ? "bg-green-100 text-green-900 border-green-300"
      : cor === "amber"
        ? "bg-amber-100 text-amber-900 border-amber-300"
        : cor === "slate"
          ? "bg-slate-200 text-slate-900 border-slate-400"
          : "bg-primary text-primary-foreground border-primary"
    : "bg-transparent border hover:bg-accent text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${corClasses}`}
    >
      {children}
    </button>
  );
}
