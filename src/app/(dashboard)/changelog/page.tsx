import { History } from "lucide-react";

export default function ChangelogPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Changelog</h1>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <History className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Nenhuma alteração registrada</h2>
        <p className="text-sm text-muted-foreground">
          Todas as mudanças em projetos, VSLs, funis, criativos e campanhas aparecerão aqui.
        </p>
      </div>
    </div>
  );
}
