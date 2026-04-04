import { Button } from "@/components/ui/button";
import { Plus, Tags } from "lucide-react";

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tags</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tag
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Tags className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Nenhuma tag ainda</h2>
        <p className="text-sm text-muted-foreground">
          Crie tags para filtrar por nicho, mercado, formato de criativo, etc.
        </p>
      </div>
    </div>
  );
}
