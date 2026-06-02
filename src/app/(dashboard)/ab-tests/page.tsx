import { Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAbTests, deleteAbTest } from "./actions";
import { AbTestFormDialog } from "./ab-test-form";
import { StatusBadge } from "@/components/ui/status-badge";

const statusLabels: Record<string, string> = {
  running: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const entityTypeLabels: Record<string, string> = {
  project: "Projeto",
  creative: "Criativo",
  campaign: "Campanha",
  vsl: "VSL",
  funnel: "Funil",
  offer: "Oferta",
};

const statusVariant: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  running: "warning",
  completed: "success",
  cancelled: "danger",
};

export default async function AbTestsPage() {
  const tests = await getAbTests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Testes A/B</h1>
        <AbTestFormDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Teste
            </Button>
          }
        />
      </div>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Trophy className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum teste A/B</h2>
          <p className="text-sm text-muted-foreground">
            Registre testes quando mudar headline, criativo ou oferta para comparar resultados.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((test) => (
            <Card key={test.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{test.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge variant={statusVariant[test.status] ?? "neutral"}>
                      {statusLabels[test.status] ?? test.status}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {entityTypeLabels[test.entityType] ?? test.entityType}
                    </span>
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteAbTest(test.id);
                  }}
                >
                  <Button variant="ghost" size="icon" type="submit">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </form>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Início: {test.startDate ? new Date(test.startDate).toLocaleDateString("pt-BR") : "-"}
                    {test.endDate && ` · Fim: ${new Date(test.endDate).toLocaleDateString("pt-BR")}`}
                  </p>
                  <div className="space-y-1">
                    {test.variants.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                          test.winnerId === v.id ? "border-success bg-success-muted" : ""
                        }`}
                      >
                        {test.winnerId === v.id && (
                          <Trophy className="h-3 w-3 text-success" />
                        )}
                        <span className="font-medium">{v.variantName}</span>
                        {v.description && (
                          <span className="text-muted-foreground">— {v.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
