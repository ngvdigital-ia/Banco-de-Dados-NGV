"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
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
import { updateOfferSiteUrls } from "@/app/(dashboard)/offers/actions";
import {
  type SiteUrls,
  type CustomLink,
  MAX_LINKS,
  totalLinks,
  isValidHttpUrl,
} from "@/lib/site-urls";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: number;
  offerName: string;
  initial: SiteUrls | null;
};

export function SiteUrlsDialog({ open, onOpenChange, offerId, offerName, initial }: Props) {
  const [domain, setDomain] = useState("");
  const [vsl, setVsl] = useState("");
  const [whites, setWhites] = useState<string[]>([]);
  const [quiz, setQuiz] = useState("");
  const [custom, setCustom] = useState<CustomLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset estado local sempre que o dialog abre com um initial diferente
  useEffect(() => {
    if (open) {
      setDomain(initial?.domain ?? "");
      setVsl(initial?.vsl ?? "");
      setWhites(initial?.whites ?? []);
      setQuiz(initial?.quiz ?? "");
      setCustom(initial?.custom ?? []);
      setError(null);
    }
  }, [open, initial]);

  const total = totalLinks({
    vsl: vsl || undefined,
    whites: whites.filter(Boolean),
    quiz: quiz || undefined,
    custom: custom.filter((c) => c.url),
  });
  const atCap = total >= MAX_LINKS;

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

    // Validação client-side rápida (server tem Zod definitivo)
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
        <DialogHeader>
          <DialogTitle>Domínios — {offerName}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cole as URLs livremente. {total}/{MAX_LINKS} links configurados.
          </p>
        </DialogHeader>

        <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
          {/* Domínio principal */}
          <Section
            title="Domínio principal"
            hint="Apenas o host (ex: meusite.com). Preenchido automaticamente com base na VSL se vazio."
          >
            <Input
              type="text"
              placeholder="meusite.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </Section>

          {/* VSL */}
          <Section title="Página VSL" hint="URL completa onde a VSL está hospedada.">
            <UrlInputWithOpen
              value={vsl}
              onChange={setVsl}
              placeholder="https://meusite.com/vsl-pt"
            />
          </Section>

          {/* Whites */}
          <Section
            title="Páginas White"
            hint="Páginas alternativas pra revisão de plataformas. Adicione quantas precisar."
          >
            <div className="grid gap-2">
              {whites.length === 0 && (
                <p className="text-xs italic text-muted-foreground">Nenhuma white cadastrada.</p>
              )}
              {whites.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <UrlInputWithOpen
                    value={w}
                    onChange={(v) => setWhite(i, v)}
                    placeholder={`https://meusite.com/white-${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeWhite(i)}
                    aria-label="Remover white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWhite}
                disabled={atCap}
                className="self-start"
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar white
              </Button>
            </div>
          </Section>

          {/* Quiz */}
          <Section title="Quiz" hint="URL única para a página de quiz desta oferta.">
            <UrlInputWithOpen
              value={quiz}
              onChange={setQuiz}
              placeholder="https://meusite.com/quiz-pt"
            />
          </Section>

          {/* Custom / Outros */}
          <Section
            title="Outros"
            hint="Pixels, página de obrigado, redirects, etc. Cada um precisa de um nome."
          >
            <div className="grid gap-2">
              {custom.length === 0 && (
                <p className="text-xs italic text-muted-foreground">Nenhum link extra.</p>
              )}
              {custom.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Nome (ex: Obrigado)"
                    value={c.label}
                    onChange={(e) => setCustomField(i, "label", e.target.value)}
                    className="w-44 flex-shrink-0"
                  />
                  <UrlInputWithOpen
                    value={c.url}
                    onChange={(v) => setCustomField(i, "url", v)}
                    placeholder="https://meusite.com/obrigado"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCustom(i)}
                    aria-label="Remover link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustom}
                disabled={atCap}
                className="self-start"
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar outro
              </Button>
            </div>
          </Section>
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm font-medium">{title}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

// Input de URL com ícone "abrir" do lado quando o valor é uma URL válida.
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
    <div className="flex items-center gap-2">
      <Input
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 font-mono text-xs"
      />
      {href && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
          aria-label="Abrir em nova aba"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
