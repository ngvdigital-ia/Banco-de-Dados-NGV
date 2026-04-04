import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Alertas</h1>
      <p className="text-muted-foreground">
        Configure alertas para ser notificado quando métricas saírem do padrão.
      </p>

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
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input name="name" placeholder="Ex: CPA Alto Projeto X" required className="w-[200px]" />
        </div>
        <div className="space-y-1">
          <Label>Entidade</Label>
          <Select name="entityType" defaultValue="project">
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Projeto</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
              <SelectItem value="creative">Criativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Métrica</Label>
          <Select name="metric" defaultValue="cpa">
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metricOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Operador</Label>
          <Select name="operator" defaultValue="gt">
            <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gt">&gt;</SelectItem>
              <SelectItem value="lt">&lt;</SelectItem>
              <SelectItem value="eq">=</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor</Label>
          <Input name="threshold" type="number" step="0.01" placeholder="50.00" required className="w-[100px]" />
        </div>
        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" />Criar
        </Button>
      </form>

      {allAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum alerta configurado</h2>
          <p className="text-sm text-muted-foreground">
            Ex: &quot;CPA &gt; R$50&quot;, &quot;Play Rate &lt; 50%&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Disparo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAlerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell>
                    <code className="text-sm">
                      {alert.metric} {operatorLabels[alert.operator]} {alert.threshold}
                    </code>
                  </TableCell>
                  <TableCell>
                    <form action={async () => {
                      "use server";
                      await toggleAlert(alert.id, !alert.active);
                    }}>
                      <Button variant="ghost" size="sm" type="submit">
                        <Badge variant={alert.active ? "default" : "secondary"}>
                          {alert.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {alert.lastTriggeredAt
                      ? new Date(alert.lastTriggeredAt).toLocaleString("pt-BR")
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <form action={async () => {
                      "use server";
                      await deleteAlert(alert.id);
                    }}>
                      <Button variant="ghost" size="icon" type="submit">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
