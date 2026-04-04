import { History, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getChangeLogs } from "./actions";

const entityLabels: Record<string, string> = {
  project: "Projeto",
  team_member: "Membro",
  vsl: "VSL",
  funnel: "Funil",
  creative: "Criativo",
  campaign: "Campanha",
  tag: "Tag",
};

const actionIcons: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const actionLabels: Record<string, string> = {
  create: "Criou",
  update: "Editou",
  delete: "Deletou",
};

const actionVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

export default async function ChangelogPage() {
  const logs = await getChangeLogs();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Changelog</h1>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <History className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhuma alteração registrada</h2>
          <p className="text-sm text-muted-foreground">
            Todas as mudanças em projetos, VSLs, funis, criativos e campanhas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const Icon = actionIcons[log.action] ?? Pencil;
            const changes = log.changesJson as Record<string, unknown> | null;

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={actionVariant[log.action] ?? "secondary"}>
                      {actionLabels[log.action] ?? log.action}
                    </Badge>
                    <span className="text-sm font-medium">
                      {entityLabels[log.entityType] ?? log.entityType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{log.entityId}
                    </span>
                  </div>
                  {changes && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(changes).map(([key, value]) => (
                        <span key={key} className="text-xs text-muted-foreground">
                          {key}: <span className="font-medium">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString("pt-BR")
                      : "-"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
