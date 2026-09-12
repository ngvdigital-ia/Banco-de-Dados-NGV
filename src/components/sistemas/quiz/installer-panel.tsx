"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
export type FunnelFormat = "quiz" | "presell";

export type FunnelSummary = {
  project_id?: string;
  id?: string;
  slug?: string;
  name?: string;
  state?: string;
  format?: FunnelFormat;
};

export type InstallationPage = {
  label?: string;
  url?: string;
  role?: "quiz" | "presell" | "vsl" | string;
  page_id?: string;
  snippet?: string;
};

export type FunnelDetails = FunnelSummary & {
  format?: FunnelFormat;
  final_url?: string | null;
  deployed_at?: string | null;
};

type FunnelResponse = {
  projects?: FunnelSummary[];
  project?: FunnelDetails;
  installation?: { pages?: InstallationPage[] };
  error?: string;
};

export type GuidedCreatedFunnel = {
  project: FunnelDetails;
  installationPages: InstallationPage[];
};

const textareaClass = cn(
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

export function projectKey(project: FunnelSummary) {
  return project.project_id ?? project.id ?? project.slug ?? "";
}

function projectName(project: FunnelSummary) {
  return project.name?.trim() || "Funil sem nome";
}

function formatLabel(format: FunnelFormat | undefined) {
  if (format === "quiz") return "Quiz → VSL";
  if (format === "presell") return "Presell → VSL";
  return "Caminho não informado";
}

function stateLabel(state: string | undefined) {
  switch (state) {
    case "receiving_events":
      return "Recebendo eventos";
    case "installed":
      return "Instalado";
    case "awaiting_deploy":
      return "Aguardando publicação";
    default:
      return state ? state.replaceAll("_", " ") : "Sem situação";
  }
}

function stateVariant(state: string | undefined): "success" | "warning" | "neutral" {
  if (state === "receiving_events" || state === "installed") return "success";
  if (state === "awaiting_deploy") return "warning";
  return "neutral";
}

function defaultUrls() {
  return ["", ""];
}

export function FunnelCreationForm({
  onCreated,
  disabled = false,
  idPrefix = "quiz-funnel-installer",
}: {
  onCreated: (created: GuidedCreatedFunnel) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<FunnelFormat>("quiz");
  const [urls, setUrls] = useState<string[]>(defaultUrls);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fieldId = (field: string) => `${idPrefix}-${field}`;
  const clearCreateError = () => setCreateError(null);

  const setFlowFormat = (nextFormat: FunnelFormat) => {
    clearCreateError();
    setFormat(nextFormat);
    setUrls(defaultUrls());
  };

  const updateUrl = (index: number, value: string) => {
    clearCreateError();
    setUrls((current) => current.map((url, currentIndex) => (currentIndex === index ? value : url)));
  };

  const addQuizPage = () => {
    clearCreateError();
    setUrls((current) => [...current.slice(0, -1), "", current[current.length - 1] ?? ""]);
  };

  const removeQuizPage = (index: number) => {
    clearCreateError();
    setUrls((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const pageLabel = (index: number) => {
    const isVsl = index === urls.length - 1;
    if (isVsl) return "URL da VSL";
    if (format === "presell") return "URL da presell";
    return urls.length > 2 ? `URL do quiz — etapa ${index + 1}` : "URL do quiz";
  };

  const createFunnel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/sistemas/quiz/funis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          format,
          pages: urls.map((url) => ({ url })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as FunnelResponse | null;
      if (!response.ok || !payload?.project) {
        throw new Error(payload?.error || "Não foi possível criar o funil.");
      }

      const created = {
        project: payload.project,
        installationPages: Array.isArray(payload.installation?.pages) ? payload.installation.pages : [],
      } satisfies GuidedCreatedFunnel;
      onCreated(created);
      setName("");
      setUrls(defaultUrls());
      toast.success("Funil criado. Copie um trecho para cada página abaixo.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Não foi possível criar o funil.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={createFunnel}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fieldId("name")}>Nome do funil</Label>
          <Input
            id={fieldId("name")}
            value={name}
            onChange={(event) => {
              clearCreateError();
              setName(event.target.value);
            }}
            placeholder="ex.: Round Popcorn"
            autoComplete="off"
            required
            disabled={creating || disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("format")}>Caminho do funil</Label>
          <Select value={format} onValueChange={(value) => setFlowFormat(value as FunnelFormat)} disabled={creating || disabled}>
            <SelectTrigger id={fieldId("format")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quiz">Quiz → VSL</SelectItem>
              <SelectItem value="presell">Presell → VSL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <p className="text-xs font-semibold">Páginas do caminho</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format === "quiz"
              ? "Um quiz pode ter uma ou várias etapas. Cada URL recebe seu próprio trecho; perguntas dentro da mesma URL continuam usando um único trecho."
              : "Informe a página de presell e a página da VSL."}
          </p>
        </div>

        {urls.map((url, index) => {
          const canRemove = format === "quiz" && index < urls.length - 1 && urls.length > 2;
          return (
            <div className="flex items-end gap-2" key={`${format}-${index}`}>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={fieldId(`url-${index}`)}>{pageLabel(index)}</Label>
                <Input
                  id={fieldId(`url-${index}`)}
                  type="url"
                  value={url}
                  onChange={(event) => updateUrl(index, event.target.value)}
                  placeholder="https://sua-pagina.com"
                  autoComplete="url"
                  required
                  disabled={creating || disabled}
                />
              </div>
              {canRemove ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeQuizPage(index)}
                  aria-label={`Remover etapa ${index + 1} do quiz`}
                  disabled={creating || disabled}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          );
        })}

        {format === "quiz" ? (
          <Button type="button" variant="outline" size="sm" onClick={addQuizPage} disabled={creating || disabled}>
            <Plus /> Adicionar etapa do quiz
          </Button>
        ) : null}
      </div>

      {createError ? <p className="text-xs text-danger" role="alert">{createError}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={creating || disabled}>
          {creating ? "Criando…" : "Criar funil e gerar trechos"}
        </Button>
      </div>
    </form>
  );
}

export function FunnelInstallationSnippets({ pages, idPrefix = "quiz-page-snippet" }: { pages: InstallationPage[]; idPrefix?: string }) {
  const copySnippet = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Trecho copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  if (pages.length === 0) {
    return <p className="text-xs text-muted-foreground">Este funil ainda não devolveu trechos de instalação.</p>;
  }

  return (
    <div className="grid gap-3">
      {pages.map((page, index) => {
        const label = page.label?.trim() || `Página ${index + 1}`;
        const snippet = page.snippet?.trim() || "";
        return (
          <section className="space-y-3 rounded-md border border-border bg-background p-3" key={`${page.url ?? label}-${index}`}>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{page.url || "URL não informada"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-${index}`}>Trecho desta página</Label>
              <textarea
                id={`${idPrefix}-${index}`}
                className={cn(textareaClass, "h-36")}
                readOnly
                spellCheck={false}
                value={snippet || "Trecho indisponível para esta página."}
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => copySnippet(snippet)} disabled={!snippet}>
                <Copy /> Copiar trecho desta página
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function buildClaudeCodexPrompt({
  funnelName,
  pages,
}: {
  funnelName: string;
  pages: InstallationPage[];
}) {
  const pagesWithoutSnippet = pages.filter((page) => !page.snippet?.trim());
  if (pagesWithoutSnippet.length > 0) {
    const unavailablePages = pagesWithoutSnippet.map((page, index) => {
      const label = page.label?.trim() || `Página ${index + 1}`;
      const url = page.url?.trim() || "URL não informada";
      return `- ${label}: ${url}`;
    }).join("\n");
    return `O trecho de instalação do Funnel Analytics ainda está indisponível para o funil \"${funnelName}\". Não instale nem publique um placeholder. Volte ao Banco NGV quando os trechos forem gerados para todas as páginas.\n\nPáginas sem trecho:\n${unavailablePages}`;
  }

  const pageInstructions = pages.length > 0
    ? pages.map((page, index) => {
      const label = page.label?.trim() || `Página ${index + 1}`;
      const url = page.url?.trim() || "URL não informada";
      const snippet = page.snippet?.trim() || "";
      return `PÁGINA ${index + 1}: ${label}\nURL: ${url}\nSNIPPET:\n${snippet}`;
    }).join("\n\n")
    : "Nenhuma página de instalação foi devolvida para este funil.";

  return `Instale o tracker do Funnel Analytics no funil \"${funnelName}\".\n\nPara CADA página abaixo:\n1. Localize no repositório o arquivo que publica exatamente a URL informada.\n2. Insira o snippet correspondente imediatamente antes de </head>, exatamente uma vez naquela página.\n3. Preserve todos os scripts, links, metatags e comportamentos já existentes.\n4. Não reutilize o snippet de uma página em outra e não altere os identificadores do trecho.\n\n${pageInstructions}\n\nDepois, execute os testes e o build aplicáveis, publique a alteração e me devolva: arquivos alterados, resultado dos testes/build e as URLs públicas verificadas.`;
}

export function canCopyClaudeCodexPrompt(pages: InstallationPage[]) {
  return pages.length > 0 && pages.every((page) => Boolean(page.snippet?.trim()));
}

function ClaudeCodexInstallPrompt({ funnelName, pages }: { funnelName: string; pages: InstallationPage[] }) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const prompt = buildClaudeCodexPrompt({ funnelName, pages });
  const canCopy = canCopyClaudeCodexPrompt(pages);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyFeedback("Prompt copiado. Cole no Claude ou Codex junto do repositório da página.");
      toast.success("Prompt copiado para Claude / Codex.");
    } catch {
      setCopyFeedback("Não foi possível copiar automaticamente. Selecione o prompt e copie manualmente.");
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <div>
        <p className="text-sm font-medium">Prompt para Claude / Codex</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Um único prompt com as URLs e os trechos corretos de cada página deste funil.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quiz-claude-codex-prompt">Prompt pronto para colar</Label>
        <textarea
          id="quiz-claude-codex-prompt"
          className={cn(textareaClass, "h-80")}
          readOnly
          spellCheck={false}
          value={prompt}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {copyFeedback}
        </p>
        <Button type="button" onClick={copyPrompt} disabled={!canCopy}>
          <Copy /> Copiar prompt para Claude / Codex
        </Button>
      </div>
    </div>
  );
}

export function InstallerPanel({ projectId }: { projectId: string }) {
  const [selected, setSelected] = useState<FunnelDetails | null>(null);
  const [installationPages, setInstallationPages] = useState<InstallationPage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingDeployment, setConfirmingDeployment] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const activeProjectIdRef = useRef(projectId);
  activeProjectIdRef.current = projectId;

  useEffect(() => {
    setConfirmingDeployment(false);
    setDeploymentError(null);
    if (!projectId) {
      setSelected(null);
      setInstallationPages([]);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setLoadingDetails(true);
      setLoadError(null);
      setSelected(null);
      setInstallationPages([]);
      try {
        const response = await fetch(`/api/sistemas/quiz/funis?project=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as FunnelResponse | null;
        if (!response.ok || !payload?.project) {
          throw new Error(payload?.error || "Não foi possível abrir este funil.");
        }
        if (cancelled) return;
        setSelected(payload.project);
        setInstallationPages(Array.isArray(payload.installation?.pages) ? payload.installation.pages : []);
      } catch (error) {
        if (!cancelled) {
          setSelected(null);
          setInstallationPages([]);
          setLoadError(error instanceof Error ? error.message : "Não foi possível abrir este funil.");
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const confirmDeployment = async () => {
    if (!selected || selected.state !== "awaiting_deploy" || confirmingDeployment) return;

    const confirmationProjectId = projectId;
    const selectedProjectId = projectKey(selected);
    const finalUrl = selected.final_url?.trim() ?? "";
    if (!confirmationProjectId || selectedProjectId !== confirmationProjectId || !finalUrl) {
      setDeploymentError("Não foi possível confirmar este funil porque a URL registrada não está disponível. Atualize a página e tente novamente.");
      return;
    }

    const confirmationIsCurrent = () => activeProjectIdRef.current === confirmationProjectId;
    setConfirmingDeployment(true);
    setDeploymentError(null);
    try {
      const response = await fetch("/api/sistemas/quiz/funis", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: confirmationProjectId, finalUrl }),
      });
      const payload = (await response.json().catch(() => null)) as FunnelResponse | null;
      if (!response.ok || !payload?.project) {
        throw new Error(payload?.error || "Não foi possível confirmar a publicação.");
      }
      if (!confirmationIsCurrent()) return;

      const confirmed = {
        ...selected,
        ...payload.project,
      } satisfies FunnelDetails;
      setSelected(confirmed);
      toast.success("Páginas confirmadas. O funil agora está instalado.");
    } catch (error) {
      if (!confirmationIsCurrent()) return;
      setDeploymentError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a publicação. Confira se os trechos já estão publicados e tente novamente.",
      );
    } finally {
      if (confirmationIsCurrent()) setConfirmingDeployment(false);
    }
  };

  return (
    <Card className="gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Instalação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Com o loader já presente nas páginas, ative o rastreamento aqui. Manual e Claude / Codex ficam disponíveis como fallback.
        </p>
      </div>

      {loadingDetails ? <p className="text-xs text-muted-foreground" aria-live="polite">Carregando trechos deste funil…</p> : null}
      {loadError ? <p className="text-xs text-danger" role="alert">{loadError}</p> : null}

      {selected && !loadingDetails ? (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{projectName(selected)}</p>
            <StatusBadge variant={stateVariant(selected.state)}>{stateLabel(selected.state)}</StatusBadge>
            <StatusBadge variant="neutral">{formatLabel(selected.format)}</StatusBadge>
          </div>

          {selected.state === "awaiting_deploy" ? (
            <div className="space-y-3 rounded-md border border-warning/40 bg-warning-muted p-3">
              <p className="text-sm text-muted-foreground">
                Quando as páginas estiverem no ar e com o loader instalado, clique em Ativar rastreamento para liberar o acompanhamento do funil.
              </p>
              {deploymentError ? <p className="text-xs text-danger" role="alert">{deploymentError}</p> : null}
              <Button type="button" onClick={confirmDeployment} disabled={confirmingDeployment}>
                {confirmingDeployment ? "Ativando rastreamento…" : "Ativar rastreamento"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Situação atual: {stateLabel(selected.state)}.
            </p>
          )}

          <Tabs key={projectId} defaultValue="manual">
            <TabsList aria-label="Modo de instalação do tracker">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="claude-codex">Claude / Codex</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-3">
              <FunnelInstallationSnippets pages={installationPages} />
            </TabsContent>
            <TabsContent value="claude-codex" className="mt-3">
              <ClaudeCodexInstallPrompt funnelName={projectName(selected)} pages={installationPages} />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </Card>
  );
}
