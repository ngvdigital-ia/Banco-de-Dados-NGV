import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getAlerts, createAlert, deleteAlert, toggleAlert } from "./actions";

const operatorLabels: Record<string, string> = {
  gt: ">",
  lt: "<",
  eq: "=",
};

const metricOptions = [
  { value: "cpa", label: "CPA" },
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Gasto" },
  { value: "revenue", label: "Receita" },
  { value: "playRate", label: "Play Rate" },
  { value: "conversionRate", label: "Conversão" },
];

export default async function AlertsPage() {
  const allAlerts = await getAlerts();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alertas"
        description="Configure notificações automáticas quando métricas saírem do padrão esperado."
      />

      {/* Formulário de criação */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5">
              <Bell className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Novo Alerta</CardTitle>
              <CardDescription>
                Ex: CPA &gt; R$50, Play Rate &lt; 50%, ROAS &lt; 2.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form
            action={async (fd: FormData) => {
              "use server";
              await createAlert({
                name: fd.get("name") as string,
                entityType: fd.get("entityType") as string,
                metric: fd.get("metric") as string,
                operator: fd.get("operator") as "gt" | "lt" | "eq",
                threshold: fd.get("threshold") as string,
              });
            }}
            className="flex items-end gap-3 flex-wrap"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</Label>
              <Input
                name="name"
                placeholder="Ex: CPA Alto Projeto X"
                required
                className="w-[200px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entidade</Label>
              <Select name="entityType" defaultValue="project">
                <SelectTrigger className="w-[130px]" aria-label="Selecionar entidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Projeto</SelectItem>
                  <SelectItem value="campaign">Campanha</SelectItem>
                  <SelectItem value="creative">Criativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Métrica</Label>
              <Select name="metric" defaultValue="cpa">
                <SelectTrigger className="w-[130px]" aria-label="Selecionar métrica">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Operador</Label>
              <Select name="operator" defaultValue="gt">
                <SelectTrigger className="w-[80px]" aria-label="Selecionar operador">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gt">&gt;</SelectItem>
                  <SelectItem value="lt">&lt;</SelectItem>
                  <SelectItem value="eq">=</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor</Label>
              <Input
                name="threshold"
                type="number"
                step="0.01"
                placeholder="50.00"
                required
                className="w-[100px] tabular-nums"
              />
            </div>
            <Button type="submit" className="self-end">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Criar Alerta
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de alertas */}
      {allAlerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-4">
          <EmptyState
            icon={Bell}
            title="Nenhum alerta configurado"
            description="Crie alertas para ser notificado quando métricas como CPA ou Play Rate saírem do padrão."
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border shadow-sm overflow-hidden ring-1 ring-foreground/5">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regra</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Último Disparo</TableHead>
                <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAlerts.map((alert) => (
                <TableRow
                  key={alert.id}
                  className="transition-colors duration-150 hover:bg-muted/30"
                >
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell>
                    <code className="rounded-md bg-muted border border-border px-1.5 py-0.5 text-xs font-mono tabular-nums">
                      {metricOptions.find((m) => m.value === alert.metric)?.label ?? alert.metric}{" "}
                      {operatorLabels[alert.operator]}{" "}
                      {alert.threshold}
                    </code>
                  </TableCell>
                  <TableCell>
                    <form action={async () => {
                      "use server";
                      await toggleAlert(alert.id, !alert.active);
                    }}>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 group"
                        aria-label={`${alert.active ? "Desativar" : "Ativar"} alerta ${alert.name}`}
                      >
                        <StatusBadge
                          variant={alert.active ? "success" : "neutral"}
                          className="transition-all duration-150 group-hover:opacity-80 cursor-pointer"
                        >
                          {alert.active ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </button>
                    </form>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {alert.lastTriggeredAt
                      ? new Date(alert.lastTriggeredAt).toLocaleString("pt-BR")
                      : <span className="text-muted-foreground/50 italic">Nunca</span>}
                  </TableCell>
                  <TableCell>
                    <form action={async () => {
                      "use server";
                      await deleteAlert(alert.id);
                    }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="submit"
                        aria-label={`Excluir alerta ${alert.name}`}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
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
