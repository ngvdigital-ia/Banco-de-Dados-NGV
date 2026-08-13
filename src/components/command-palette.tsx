"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { getSearchIndex } from "@/app/(dashboard)/search-actions";
import type { SearchIndex } from "@/app/(dashboard)/search-actions";

// ---------------------------------------------------------------------------
// Páginas estáticas
// ---------------------------------------------------------------------------
const STATIC_PAGES = [
  { label: "Dashboard", href: "/dashboard" },
  ...(isOperationCockpitEnabled ? [{ label: "Operação", href: "/operacao" }] : []),
  { label: "Projetos", href: "/projects" },
  { label: "Ofertas", href: "/offers" },
  { label: "Agentes", href: "/agentes" },
  { label: "Equipe", href: "/team" },
  { label: "Métricas", href: "/metrics" },
  { label: "Análises", href: "/analytics" },
  { label: "Vendas", href: "/vendas" },
  { label: "Alertas", href: "/alertas" },
  { label: "Import", href: "/import" },
  { label: "Integrações", href: "/settings" },
  { label: "Tags", href: "/tags" },
  { label: "Changelog", href: "/changelog" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface FlatItem {
  label: string;
  href: string;
  group: "Páginas" | "Ofertas" | "Pessoas";
}

const MAX_PER_GROUP = 8;

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setSelectedIdx(0);
    setOpen(true);
    // Autofocus no próximo tick (após animação do Dialog abrir)
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Abre via atalho de teclado
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette]);

  // Abre via evento customizado (disparado pelo trigger externo)
  useEffect(() => {
    function onOpen() {
      openPalette();
    }
    window.addEventListener("open-command-palette", onOpen);
    return () => window.removeEventListener("open-command-palette", onOpen);
  }, [openPalette]);

  // Carrega índice lazy (somente na primeira abertura)
  useEffect(() => {
    if (open && !indexLoaded) {
      getSearchIndex()
        .then((data) => {
          setIndex(data);
          setIndexLoaded(true);
        })
        .catch(() => {
          // Falha silenciosa: palette ainda funciona com páginas estáticas
          setIndexLoaded(true);
        });
    }
  }, [open, indexLoaded]);

  // Constrói lista visível
  const visibleItems: FlatItem[] = (() => {
    const q = normalize(query);

    const pages: FlatItem[] = STATIC_PAGES.filter((p) =>
      !q || normalize(p.label).includes(q)
    )
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({ label: p.label, href: p.href, group: "Páginas" }));

    if (!q) return pages;

    const offers: FlatItem[] = (index?.offers ?? [])
      .filter((o) => normalize(o.name).includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((o) => ({
        label: o.name,
        href: `/offers?month=all`,
        group: "Ofertas",
      }));

    const members: FlatItem[] = (index?.members ?? [])
      .filter((m) => normalize(m.name).includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((m) => ({
        label: m.name,
        href: `/analytics/team`,
        group: "Pessoas",
      }));

    return [...pages, ...offers, ...members];
  })();

  // Garante que selectedIdx não ultrapasse a lista
  const clampedIdx = Math.min(selectedIdx, Math.max(0, visibleItems.length - 1));

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, visibleItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = visibleItems[clampedIdx];
      if (item) navigate(item.href);
    }
  }

  // Scroll automático para o item selecionado
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${clampedIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [clampedIdx]);

  // Agrupa para renderização com cabeçalhos
  const groups: { group: FlatItem["group"]; items: (FlatItem & { flatIdx: number })[] }[] = [];
  let flatIdx = 0;
  const groupOrder: FlatItem["group"][] = ["Páginas", "Ofertas", "Pessoas"];

  for (const gName of groupOrder) {
    const items = visibleItems
      .map((item, i) => ({ ...item, flatIdx: i }))
      .filter((item) => item.group === gName);
    if (items.length > 0) {
      groups.push({ group: gName, items });
      flatIdx += items.length;
    }
  }
  void flatIdx; // suppress unused warning

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 sm:max-w-lg overflow-hidden"
      >
        {/* Campo de busca */}
        <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, ofertas, pessoas…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Campo de busca global"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar busca"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Lista de resultados */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto py-1.5"
          role="listbox"
          aria-label="Resultados da busca"
        >
          {visibleItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                  {group}
                </p>
                {items.map((item) => (
                  <button
                    key={`${item.group}-${item.label}`}
                    data-idx={item.flatIdx}
                    type="button"
                    role="option"
                    aria-selected={item.flatIdx === clampedIdx}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIdx(item.flatIdx)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                      item.flatIdx === clampedIdx
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.group !== "Páginas" && (
                      <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">
                        {item.group === "Ofertas" ? "→ lista de ofertas" : "→ analytics/equipe"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Rodapé com hints */}
        <div className="border-t px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground select-none">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Trigger externo (botão no header)
// ---------------------------------------------------------------------------
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border"
      aria-label="Abrir busca global (Ctrl K)"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Buscar</span>
      <kbd className="hidden sm:inline font-mono text-[10px] opacity-60 ml-0.5">Ctrl K</kbd>
    </button>
  );
}
