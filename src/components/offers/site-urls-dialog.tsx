"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ExternalLink, Globe, Link2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateOfferSiteUrls } from "@/app/(dashboard)/offers/actions";
import {
  type SiteUrls,
  type CustomLink,
  MAX_LINKS,
  totalLinks,
  isValidHttpUrl,
} from "@/lib/site-urls";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: number;
  offerName: string;
  initial: SiteUrls | null;
};

export function SiteUrlsDialog({ open, onOpenChange, offerId, offerName, initial }: Props) {
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [vsl, setVsl] = useState(initial?.vsl ?? "");
  const [whites, setWhites] = useState<string[]>(initial?.whites ?? []);
  const [quiz, setQuiz] = useState(initial?.quiz ?? "");
  const [custom, setCustom] = useState<CustomLink[]>(initial?.custom ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = totalLinks({
    vsl: vsl || undefined,
    whites: whites.filter(Boolean),
    quiz: quiz || undefined,
    custom: custom.filter((c) => c.url),
  });
  const atCap = total >= MAX_LINKS;
  const capPct = Math.min((total / MAX_LINKS) * 100, 100);

  function setWhite(i: number, v: string) {
    setWhites((prev) => prev.map((w, idx) => (idx === i ? v : w)));
  }
  function removeWhite(i: number) {
    setWhites((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addWhite() {
    if (atCap) return;
    setWhites((prev) => [...prev, ""]);
  }

  function setCustomField(i: number, key: keyof CustomLink, v: string) {
    setCustom((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: v } : c)));
  }
  function removeCustom(i: number) {
    setCustom((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addCustom() {
    if (atCap) return;
    setCustom((prev) => [...prev, { label: "", url: "" }]);
  }

  function handleSave() {
    setError(null);

    const allUrls = [
      ...(vsl ? [vsl] : []),
      ...whites.filter(Boolean),
      ...(quiz ? [quiz] : []),
      ...custom.filter((c) => c.url).map((c) => c.url),
    ];
    for (const u of allUrls) {
      if (!isValidHttpUrl(u)) {
        setError(`URL inválida: ${u}`);
        return;
      }
    }
    for (const c of custom) {
      if (c.url && !c.label.trim()) {
        setError("Todo link em 'Outros' precisa de um nome (label)");
        return;
      }
    }

    const value: SiteUrls = {
      ...(domain.trim() ? { domain: domain.trim() } : {}),
      ...(vsl.trim() ? { vsl: vsl.trim() } : {}),
      ...(whites.some(Boolean) ? { whites: whites.filter(Boolean).map((w) => w.trim()) } : {}),
      ...(quiz.trim() ? { quiz: quiz.trim() } : {}),
      ...(custom.some((c) => c.url)
        ? {
            custom: custom
              .filter((c) => c.url)
              .map((c) => ({ label: c.label.trim(), url: c.url.trim() })),
          }
        : {}),
    };

    startTransition(async () => {
      try {
        await updateOfferSiteUrls(offerId, value);
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-tight">Domínios</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">{offerName}</p>
            </div>
          </div>

          {/* Contador de links — barra de progresso elegante */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  atCap ? "bg-danger" : total >= MAX_LINKS * 0.8 ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${capPct}%` }}
              />
            </div>
            <span
              className={cn(
                "tabular-nums text-xs font-medium shrink-0",
                atCap ? "text-danger" : "text-muted-foreground",
              )}
            >
              {total}/{MAX_LINKS}
            </span>
          </div>
        </DialogHeader>

        <div className="grid gap-0 py-1 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
          {/* Domínio principal */}
          <Section
            title="Domínio principal"
            hint="Apenas o host, ex: meusite.com. Auto-preenchido pela VSL se vazio."
          >
            <Input
              type="text"
              placeholder="meusite.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="font-mono text-xs"
            />
          </Section>

          <SectionDivider />

          {/* VSL */}
          <Section title="Página VSL" hint="URL completa onde a VSL está hospedada.">
            <UrlInputWithOpen
              value={vsl}
              onChange={setVsl}
              placeholder="https://meusite.com/vsl-pt"
            />
          </Section>

          <SectionDivider />

          {/* Whites */}
          <Section
            title="Páginas White"
            hint="Páginas alternativas para revisão de plataformas."
            badge={whites.length > 0 ? String(whites.length) : undefined}
          >
            <div className="grid gap-2">
              {whites.length === 0 && (
                <p className="text-xs text-muted-foreground/70 italic">
                  Nenhuma white cadastrada.
                </p>
              )}
              {whites.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="tabular-nums text-xs text-muted-foreground/50 w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <UrlInputWithOpen
                    value={w}
                    onChange={(v) => setWhite(i, v)}
                    placeholder={`https://meusite.com/white-${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeWhite(i)}
                    aria-label="Remover white"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/50 hover:text-danger hover:bg-danger/8 transition-colors duration-150 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addWhite}
                disabled={atCap}
                className={cn(
                  "group flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-xs font-medium border transition-all duration-150",
                  atCap
                    ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                    : "border-primary/30 text-primary hover:bg-primary/6 hover:border-primary/60",
                )}
              >
                <Plus className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                Adicionar white
              </button>
            </div>
          </Section>

          <SectionDivider />

          {/* Quiz */}
          <Section title="Quiz" hint="URL única para a página de quiz desta oferta.">
            <UrlInputWithOpen
              value={quiz}
              onChange={setQuiz}
              placeholder="https://meusite.com/quiz-pt"
            />
          </Section>

          <SectionDivider />

          {/* Custom / Outros */}
          <Section
            title="Outros"
            hint="Pixels, página de obrigado, redirects — cada um precisa de um nome."
            badge={custom.length > 0 ? String(custom.length) : undefined}
          >
            <div className="grid gap-2">
              {custom.length === 0 && (
                <p className="text-xs text-muted-foreground/70 italic">Nenhum link extra.</p>
              )}
              {custom.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Nome"
                    value={c.label}
                    onChange={(e) => setCustomField(i, "label", e.target.value)}
                    className="w-36 shrink-0 text-xs"
                  />
                  <UrlInputWithOpen
                    value={c.url}
                    onChange={(v) => setCustomField(i, "url", v)}
                    placeholder="https://meusite.com/obrigado"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustom(i)}
                    aria-label="Remover link"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/50 hover:text-danger hover:bg-danger/8 transition-colors duration-150 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCustom}
                disabled={atCap}
                className={cn(
                  "group flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-xs font-medium border transition-all duration-150",
                  atCap
                    ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                    : "border-primary/30 text-primary hover:bg-primary/6 hover:border-primary/60",
                )}
              >
                <Plus className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                Adicionar outro
              </button>
            </div>
          </Section>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-muted px-3 py-2.5 text-xs text-danger-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending} className="min-w-[80px]">
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionDivider() {
  return <Separator className="my-4 opacity-50" />;
}

function Section({
  title,
  hint,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold tracking-tight">{title}</Label>
        {badge && (
          <span className="tabular-nums inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/12 px-1.5 text-[10px] font-semibold text-primary">
            {badge}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground leading-snug -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function UrlInputWithOpen({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const valid = value.trim() !== "" && isValidHttpUrl(value.trim());
  const href = valid
    ? value.trim().startsWith("http")
      ? value.trim()
      : `https://${value.trim()}`
    : null;
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <div className="relative flex-1">
        <Link2 className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
        <Input
          type="url"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-7 font-mono text-xs"
        />
      </div>
      {href ? (
        <button
          type="button"
          onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
          aria-label="Abrir em nova aba"
          className="flex h-8 w-8 items-center justify-center rounded-md text-primary/60 hover:text-primary hover:bg-primary/8 transition-colors duration-150 shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="h-8 w-8 shrink-0" />
      )}
    </div>
  );
}
