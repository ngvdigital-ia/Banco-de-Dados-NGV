import { Suspense } from "react";
import { Plus, FolderOpen, Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectFormDialog } from "@/components/forms/project-form";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { EntityFilters } from "@/components/filters/entity-filters";
import { getProjects, deleteProject } from "./actions";

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

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const niche = typeof params.niche === "string" ? params.niche : undefined;
  const language = typeof params.language === "string" ? params.language : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const allProjectsUnfiltered = await getProjects();
  const uniqueNiches = [...new Set(allProjectsUnfiltered.map((p) => p.niche))].sort();
  const uniqueLanguages = [...new Set(allProjectsUnfiltered.map((p) => p.language))].sort();
  const uniqueStatuses = [...new Set(allProjectsUnfiltered.map((p) => p.status))].sort();

  const allProjects = await getProjects({ niche, language, status });
  const hasFilters = !!(niche || language || status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos"
        description="Gerencie os projetos VSL e TSL da operação."
      >
        <ProjectFormDialog
          trigger={
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              Novo Projeto
            </Button>
          }
        />
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={null}>
          <DateRangeFilter />
        </Suspense>
        <Suspense fallback={null}>
          <EntityFilters
            filters={{
              niches: uniqueNiches,
              languages: uniqueLanguages,
              statuses: uniqueStatuses,
            }}
          />
        </Suspense>
      </div>

      {allProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={FolderOpen}
            title={hasFilters ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
            description={
              hasFilters
                ? "Tente ajustar os filtros para ver mais resultados."
                : "Crie seu primeiro projeto para começar a organizar seus dados."
            }
          />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                <TableHead className="font-semibold text-foreground">Nicho</TableHead>
                <TableHead className="font-semibold text-foreground">Idioma</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[120px] font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="group transition-colors duration-150 hover:bg-primary/[0.03]"
                >
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-semibold text-foreground transition-colors duration-150 hover:text-primary group-hover:underline decoration-primary/40 underline-offset-2"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {typeLabels[project.type] ?? project.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.niche}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.language}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={statusVariant[project.status] ?? "neutral"}>
                      {statusLabels[project.status] ?? project.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ver projeto"
                        className="h-7 w-7 text-muted-foreground transition-colors hover:text-primary"
                        render={<Link href={`/projects/${project.id}`} />}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <ProjectFormDialog
                        project={project}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar projeto"
                            className="h-7 w-7 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteProject(project.id);
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          type="submit"
                          aria-label="Excluir projeto"
                          className="h-7 w-7 text-muted-foreground transition-colors hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
