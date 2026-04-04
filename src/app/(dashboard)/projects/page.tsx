import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projetos</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Projeto
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Nenhum projeto ainda</h2>
        <p className="text-sm text-muted-foreground">
          Crie seu primeiro projeto para começar a organizar seus dados.
        </p>
      </div>
    </div>
  );
}
