import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
  Video,
  ListChecks,
  RefreshCw,
  Globe,
} from "lucide-react";
import { SyncButton } from "./sync-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";

async function getLastSync(source: string) {
  const result = await db
    .select({ createdAt: metricsSnapshots.createdAt })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.source, source as "manual" | "utmify" | "meta_api" | "tiktok_api"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(1);

  return result[0]?.createdAt ?? null;
}

function IntegrationStatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <StatusBadge variant="success">
      <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
      Conectado
    </StatusBadge>
  ) : (
    <StatusBadge variant="danger">
      <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
      Desconectado
    </StatusBadge>
  );
}

function formatDate(date: Date | null) {
  if (!date) return "Nunca sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

interface IntegrationCardProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  connected: boolean;
  children: React.ReactNode;
}

function IntegrationCard({ icon: Icon, iconColor, title, connected, children }: IntegrationCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-foreground/5 transition-all duration-200 hover:shadow-md hover:border-primary/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5">
            <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <IntegrationStatusBadge connected={connected} />
      </div>
      <div className="space-y-2 text-sm text-muted-foreground pl-1">
        {children}
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const utmifyConnected = !!process.env.UTMIFY_API_KEY;
  const clickupConnected = !!process.env.CLICKUP_API_KEY;
  const vturbConnected = !!process.env.VTURB_API_KEY;

  const lastUtmifySync = await getLastSync("utmify");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrações"
        description="Configure e monitore as conexões externas do dashboard NGV."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* UTMify */}
        <IntegrationCard
          icon={Globe}
          iconColor="text-primary"
          title="UTMify / Vendas"
          connected={utmifyConnected}
        >
          <p><span className="font-medium text-foreground">Dashboards:</span></p>
          <ul className="ml-4 list-disc space-y-0.5 marker:text-primary/50">
            <li>Principal-NGV DIGITAL (BRL)</li>
            <li>Dash Conta em Dolar (USD)</li>
          </ul>
          <p className="mt-2">
            <span className="font-medium text-foreground">Última sincronização:</span>{" "}
            <span className="tabular-nums">{formatDate(lastUtmifySync)}</span>
          </p>
          <div className="mt-3 rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-1.5">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">Webhook de Vendas</p>
            <code className="block rounded-md bg-muted border border-border p-2 text-xs break-all font-mono text-foreground/80">
              https://banco-de-dados-ngv.vercel.app/api/webhooks/sales
            </code>
            <p className="text-xs leading-relaxed">
              Configure nas plataformas de pagamento (Cartpanda, Hotmart, PerfectPay) para receber vendas automaticamente.
            </p>
          </div>
          <p className="text-xs mt-2 leading-relaxed">
            <span className="font-medium text-foreground">Sync via Claude:</span> Peça &quot;atualiza UTMify&quot; para puxar dados completos.
          </p>
        </IntegrationCard>

        {/* ClickUp */}
        <IntegrationCard
          icon={ListChecks}
          iconColor="text-primary"
          title="ClickUp"
          connected={clickupConnected}
        >
          <div className="space-y-1">
            <p><span className="font-medium text-foreground">Workspace:</span> NGV Digital</p>
            <p><span className="font-medium text-foreground">Space ID:</span> <span className="font-mono tabular-nums text-xs">90131585986</span></p>
          </div>
          <p className="mt-1"><span className="font-medium text-foreground">Listas monitoradas:</span></p>
          <ul className="ml-4 list-disc space-y-0.5 marker:text-primary/50">
            <li>Outros</li>
            <li>Sites</li>
          </ul>
          <p className="mt-2">
            <span className="font-medium text-foreground">Frequência:</span> A cada 6 horas (cron)
          </p>
          {clickupConnected && (
            <div className="mt-4 pt-3 border-t border-border">
              <SyncButton endpoint="/api/cron/sync-clickup" label="Sync ClickUp Agora" />
            </div>
          )}
        </IntegrationCard>

        {/* VTurb */}
        <IntegrationCard
          icon={Video}
          iconColor="text-warning-muted-foreground"
          title="VTurb"
          connected={vturbConnected}
        >
          {vturbConnected ? (
            <>
              <p>
                <span className="font-medium text-foreground">Frequência:</span> A cada 12 horas (cron)
              </p>
              <div className="mt-4 pt-3 border-t border-border">
                <SyncButton endpoint="/api/cron/sync-vturb" label="Sync VTurb Agora" />
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg bg-warning-muted border border-warning p-3 text-warning-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                Não configurado — adicione{" "}
                <code className="rounded bg-background/50 px-1.5 py-0.5 font-mono text-xs border border-border">
                  VTURB_API_KEY
                </code>{" "}
                nas variáveis de ambiente para ativar.
              </p>
            </div>
          )}
        </IntegrationCard>

        {/* Placeholder para Google Sheets */}
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Google Sheets</p>
          <p className="text-xs text-muted-foreground max-w-[180px]">
            Integração em breve
          </p>
        </div>
      </div>
    </div>
  );
}
