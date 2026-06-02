import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricsForm } from "./metrics-form";
import { getAllProjects } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { BarChart2 } from "lucide-react";

export default async function MetricsPage() {
  const projects = await getAllProjects();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Métricas Manuais"
        description="Preencha métricas que o UTMify não cobre: play rate, retenção do vídeo, taxa de clique no botão, conversão do checkout, etc."
      />

      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5">
              <BarChart2 className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Nova Entrada de Métricas</CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                Os dados são gravados em <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border">metrics_snapshots</span> e aparecem nos gráficos de analytics.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <MetricsForm projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
