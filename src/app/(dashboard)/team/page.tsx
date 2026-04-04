import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Equipe</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Membro
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Users className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Nenhum membro ainda</h2>
        <p className="text-sm text-muted-foreground">
          Cadastre os membros da equipe (copywriters, editores, gestores de tráfego).
        </p>
      </div>
    </div>
  );
}
