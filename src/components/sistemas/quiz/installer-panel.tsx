"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { QuizTrackerInstallation } from "@/lib/sistemas/quiz/projects-client.mjs";

type FunnelFormat = "quiz" | "presell";

type FunnelSummary = {
  project_id?: string;
  id?: string;
  slug?: string;
  name?: string;
  state?: string;
  format?: FunnelFormat;
};

type InstallationPage = {
  label?: string;
  url?: string;
  role?: "quiz" | "presell" | "vsl" | string;
  page_id?: string;
  snippet?: string;
};

type FunnelDetails = FunnelSummary & {
  format?: FunnelFormat;
};

type FunnelResponse = {
  projects?: FunnelSummary[];
  project?: FunnelDetails;
  installation?: { pages?: InstallationPage[] };
  error?: string;
};

// A tela pai ainda fornece a instalação recém-criada por integrações anteriores.
// O fluxo guiado usa apenas o projectId para abrir o mesmo funil sem exigir IDs ao operador.
type InstallerPanelProps = {
  installation?: QuizTrackerInstallation;
  initialDomain?: string;
};

const textareaClass = cn(
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

function projectKey(project: FunnelSummary) {
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

function projectFromLocation() {
  const candidate = new URLSearchParams(window.location.search).get("project")?.trim() ?? "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : "";
}

export function InstallerPanel({ installation }: InstallerPanelProps) {
  const [projects, setProjects] = useState<FunnelSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selected, setSelected] = useState<FunnelDetails | null>(null);
  const [installationPages, setInstallationPages] = useState<InstallationPage[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [format, setFormat] = useState<FunnelFormat>("quiz");
  const [urls, setUrls] = useState<string[]>(defaultUrls);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/sistemas/quiz/funis", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as FunnelResponse | null;
      if (!response.ok || !payload || !Array.isArray(payload.projects)) {
        throw new Error(payload?.error || "Não foi possível carregar os funis agora.");
      }
      setProjects(payload.projects);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os funis agora.");
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  // O link compartilhado do Banco usa ?project=<slug>. Lemos uma vez depois da hidratação
  // para não criar diferença servidor/cliente nem sobrescrever uma seleção manual posterior.
  useEffect(() => {
    const project = projectFromLocation() || installation?.attributes.projectId?.trim() || "";
    if (project) setSelectedKey(project);
  }, [installation]);

  useEffect(() => {
    if (!selectedKey) {
      setSelected(null);
      setInstallationPages([]);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setLoadingDetails(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/sistemas/quiz/funis?project=${encodeURIComponent(selectedKey)}`, {
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
  }, [selectedKey]);

  const setFlowFormat = (nextFormat: FunnelFormat) => {
    setFormat(nextFormat);
    setUrls(defaultUrls());
  };

  const updateUrl = (index: number, value: string) => {
    setUrls((current) => current.map((url, currentIndex) => (currentIndex === index ? value : url)));
  };

  const addQuizPage = () => {
    setUrls((current) => [...current.slice(0, -1), "", current[current.length - 1] ?? ""]);
  };

  const removeQuizPage = (index: number) => {
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

      setSelected(payload.project);
      setInstallationPages(Array.isArray(payload.installation?.pages) ? payload.installation.pages : []);
      setSelectedKey(projectKey(payload.project));
      setName("");
      setUrls(defaultUrls());
      setProjects((current) => {
        const key = projectKey(payload.project!);
        const withoutCurrent = current.filter((project) => projectKey(project) !== key);
        return [payload.project!, ...withoutCurrent];
      });
      toast.success("Funil criado. Copie um trecho para cada página abaixo.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Não foi possível criar o funil.");
    } finally {
      setCreating(false);
    }
  };

  const copySnippet = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Trecho copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="gap-5 p-5">
        <div>
          <h2 className="text-sm font-semibold">Criar funil</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dê um nome, informe as páginas e o Banco gera os trechos certos. Você não precisa preencher IDs técnicos.
          </p>
        </div>

        <form className="space-y-4" onSubmit={createFunnel}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-funnel-name">Nome do funil</Label>
              <Input
                id="quiz-funnel-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="ex.: Round Popcorn"
                autoComplete="off"
                required
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-funnel-format">Caminho do funil</Label>
              <Select value={format} onValueChange={(value) => setFlowFormat(value as FunnelFormat)} disabled={creating}>
                <SelectTrigger id="quiz-funnel-format" className="w-full">
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
                    <Label htmlFor={`quiz-funnel-url-${index}`}>{pageLabel(index)}</Label>
                    <Input
                      id={`quiz-funnel-url-${index}`}
                      type="url"
                      value={url}
                      onChange={(event) => updateUrl(index, event.target.value)}
                      placeholder="https://sua-pagina.com"
                      autoComplete="url"
                      required
                      disabled={creating}
                    />
                  </div>
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeQuizPage(index)}
                      aria-label={`Remover etapa ${index + 1} do quiz`}
                      disabled={creating}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              );
            })}

            {format === "quiz" ? (
              <Button type="button" variant="outline" size="sm" onClick={addQuizPage} disabled={creating}>
                <Plus /> Adicionar etapa do quiz
              </Button>
            ) : null}
          </div>

          {createError ? <p className="text-xs text-danger" role="alert">{createError}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? "Criando…" : "Criar funil e gerar trechos"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Funil em foco</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecione um funil registrado. Nome e situação vêm da lista canônica; nenhum ID precisa ser digitado.
          </p>
        </div>

        <div className="max-w-xl space-y-2">
          <Label htmlFor="quiz-existing-funnel">Funil</Label>
          <Select value={selectedKey} onValueChange={(value) => setSelectedKey(value ?? "")} disabled={loadingProjects || projects.length === 0}>
            <SelectTrigger id="quiz-existing-funnel" className="w-full">
              <SelectValue placeholder={loadingProjects ? "Carregando funis…" : "Selecione um funil"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => {
                const key = projectKey(project);
                return (
                  <SelectItem key={key} value={key}>
                    {projectName(project)} · {stateLabel(project.state)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {loadingProjects ? <p className="text-xs text-muted-foreground">Carregando os funis registrados…</p> : null}
          {!loadingProjects && projects.length === 0 && !loadError ? <p className="text-xs text-muted-foreground">Ainda não há funis cadastrados.</p> : null}
          {loadError ? <p className="text-xs text-danger" role="alert">{loadError}</p> : null}
        </div>

        {loadingDetails ? <p className="text-xs text-muted-foreground">Carregando trechos deste funil…</p> : null}

        {selected && !loadingDetails ? (
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{projectName(selected)}</p>
              <StatusBadge variant={stateVariant(selected.state)}>{stateLabel(selected.state)}</StatusBadge>
              <StatusBadge variant="neutral">{formatLabel(selected.format)}</StatusBadge>
            </div>

            {installationPages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Este funil ainda não devolveu trechos de instalação.</p>
            ) : (
              <div className="grid gap-3">
                {installationPages.map((page, index) => {
                  const label = page.label?.trim() || `Página ${index + 1}`;
                  const snippet = page.snippet?.trim() || "";
                  return (
                    <section className="space-y-3 rounded-md border border-border bg-background p-3" key={`${page.url ?? label}-${index}`}>
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{page.url || "URL não informada"}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`quiz-page-snippet-${index}`}>Trecho desta página</Label>
                        <textarea
                          id={`quiz-page-snippet-${index}`}
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
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
