import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, GitBranch, Layers, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { getProject } from "../actions";
import { VslsTab } from "./vsls-tab";
import { FunnelTab } from "./funnel-tab";
import { CreativesTab } from "./creatives-tab";

const statusLabels: Record<string, string> = {
  escalou: "Escalou",
  nao_escalou: "Não Escalou",
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

type StatusVariant = "success" | "danger" | "info" | "warning" | "neutral";

const statusVariant: Record<string, StatusVariant> = {
  escalou: "success",
  nao_escalou: "danger",
  em_teste: "info",
  rodando: "success",
  pausado: "neutral",
};

const typeLabels: Record<string, string> = {
  vsl: "VSL",
  tsl: "TSL",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(Number(id));

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header do projeto */}
      <div className="space-y-4">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Voltar para projetos"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            render={<Link href="/projects" />}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Projetos
          </Button>
          <span className="text-muted-foreground/50 text-xs">/</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{project.name}</span>
        </div>

        {/* Título + metadados */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <h1 className="truncate">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {typeLabels[project.type] ?? project.type}
              </span>

              <span className="h-3 w-px bg-border" aria-hidden="true" />

              <span className="text-xs text-muted-foreground">{project.niche}</span>

              <span className="h-3 w-px bg-border" aria-hidden="true" />

              <span className="text-xs text-muted-foreground">{project.language}</span>

              <span className="h-3 w-px bg-border" aria-hidden="true" />

              <StatusBadge variant={statusVariant[project.status] ?? "neutral"}>
                {statusLabels[project.status] ?? project.status}
              </StatusBadge>

              {project.status === "escalou" && project.scaleStartDate && (
                <>
                  <span className="h-3 w-px bg-border" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Escala:{" "}
                    <span className="text-foreground font-medium">
                      {new Date(project.scaleStartDate).toLocaleDateString("pt-BR")}
                    </span>
                    {project.scaleEndDate
                      ? ` – ${new Date(project.scaleEndDate).toLocaleDateString("pt-BR")}`
                      : " – atual"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Separator />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vsls">
        <TabsList className="h-9 gap-0.5 bg-muted/50 p-0.5">
          <TabsTrigger value="vsls" className="h-8 gap-1.5 px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            VSLs
          </TabsTrigger>
          <TabsTrigger value="funnel" className="h-8 gap-1.5 px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="creatives" className="h-8 gap-1.5 px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Criativos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="vsls" className="mt-5">
          <VslsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="funnel" className="mt-5">
          <FunnelTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="creatives" className="mt-5">
          <CreativesTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
