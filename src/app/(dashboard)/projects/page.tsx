import { Suspense } from "react";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  escalou: "default",
  nao_escalou: "destructive",
  em_teste: "outline",
  rodando: "default",
  pausado: "secondary",
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

  // Get all projects (unfiltered) to extract unique filter options
  const allProjectsUnfiltered = await getProjects();
  const uniqueNiches = [...new Set(allProjectsUnfiltered.map((p) => p.niche))].sort();
  const uniqueLanguages = [...new Set(allProjectsUnfiltered.map((p) => p.language))].sort();
  const uniqueStatuses = [...new Set(allProjectsUnfiltered.map((p) => p.status))].sort();

  // Get filtered projects
  const allProjects = await getProjects({ niche, language, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projetos</h1>
        <ProjectFormDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          }
        />
      </div>

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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Nenhum projeto encontrado</h2>
          <p className="text-sm text-muted-foreground">
            {niche || language || status
              ? "Tente ajustar os filtros para ver mais resultados."
              : "Crie seu primeiro projeto para começar a organizar seus dados."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabels[project.type] ?? project.type}</Badge>
                  </TableCell>
                  <TableCell>{project.niche}</TableCell>
                  <TableCell>{project.language}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[project.status] ?? "default"}>
                      {statusLabels[project.status] ?? project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" render={<Link href={`/projects/${project.id}`} />}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <ProjectFormDialog
                        project={project}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteProject(project.id);
                        }}
                      >
                        <Button variant="ghost" size="icon" type="submit">
                          <Trash2 className="h-4 w-4 text-destructive" />
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
