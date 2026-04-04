import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricsForm } from "./metrics-form";
import { getAllProjects } from "./actions";

export default async function MetricsPage() {
  const projects = await getAllProjects();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Métricas Manuais</h1>
      <p className="text-muted-foreground">
        Preencha métricas que o UTMify não cobre: play rate, retenção do vídeo,
        taxa de clique no botão, conversão do checkout, etc.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Nova Entrada de Métricas</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsForm projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
