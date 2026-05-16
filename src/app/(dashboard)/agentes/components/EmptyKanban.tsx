import { Inbox } from "lucide-react";

export function EmptyKanban() {
  return (
    <div className="bg-card border rounded-lg p-12 text-center max-w-md mx-auto">
      <Inbox
        className="h-12 w-12 text-muted-foreground mx-auto mb-3"
        aria-hidden="true"
      />
      <p className="text-sm font-medium mb-1">Nenhuma oferta em produção</p>
      <p className="text-xs text-muted-foreground">
        Quando uma oferta for criada no ClickUp, ela aparece aqui.
      </p>
    </div>
  );
}
