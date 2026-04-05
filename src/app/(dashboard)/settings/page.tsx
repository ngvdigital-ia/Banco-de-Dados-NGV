import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, XCircle, AlertTriangle, Webhook, Settings, Video, ListChecks } from "lucide-react";
import { SyncButton } from "./sync-button";

async function getLastSync(source: string) {
  const result = await db
    .select({ createdAt: metricsSnapshots.createdAt })
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.source, source as "manual" | "utmify" | "meta_api" | "tiktok_api"))
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(1);

  return result[0]?.createdAt ?? null;
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      <CheckCircle2 className="h-3 w-3" />
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      <XCircle className="h-3 w-3" />
      Desconectado
    </span>
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

export default async function SettingsPage() {
  const utmifyConnected = !!process.env.UTMIFY_API_KEY;
  const clickupConnected = !!process.env.CLICKUP_API_KEY;
  const vturbConnected = !!process.env.VTURB_API_KEY;
  const sheetsSecretConfigured = !!process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  const lastUtmifySync = await getLastSync("utmify");

  const webhookUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/webhooks/google-sheets`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://SEU-DOMINIO.vercel.app"}/api/webhooks/google-sheets`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integrações</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* UTMify Card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">UTMify</h2>
            </div>
            <StatusBadge connected={utmifyConnected} />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Dashboards:</strong></p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Principal-NGV DIGITAL (BRL)</li>
              <li>Dash Conta em Dolar (USD)</li>
            </ul>
            <p className="mt-3">
              <strong>Última sincronização:</strong>{" "}
              {formatDate(lastUtmifySync)}
            </p>
            <p>
              <strong>Frequência:</strong> A cada 6 horas (cron)
            </p>
          </div>
          {utmifyConnected && (
            <div className="mt-4">
              <SyncButton endpoint="/api/cron/sync-utmify" label="Sync UTMify Agora" />
            </div>
          )}
        </div>

        {/* ClickUp Card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">ClickUp</h2>
            </div>
            <StatusBadge connected={clickupConnected} />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Workspace:</strong> NGV Digital</p>
            <p><strong>Space:</strong> NGV Digital (ID: 90131585986)</p>
            <p><strong>Listas monitoradas:</strong></p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Outros</li>
              <li>Sites</li>
            </ul>
            <p className="mt-3">
              <strong>Frequência:</strong> A cada 6 horas (cron)
            </p>
          </div>
          {clickupConnected && (
            <div className="mt-4">
              <SyncButton endpoint="/api/cron/sync-clickup" label="Sync ClickUp Agora" />
            </div>
          )}
        </div>

        {/* VTurb Card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold">VTurb</h2>
            </div>
            <StatusBadge connected={vturbConnected} />
          </div>
          {vturbConnected ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Frequência:</strong> A cada 12 horas (cron)</p>
              <div className="mt-4">
                <SyncButton endpoint="/api/cron/sync-vturb" label="Sync VTurb Agora" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Não configurado — adicione <code className="rounded bg-amber-100 px-1 font-mono text-xs">VTURB_API_KEY</code> nas variáveis de ambiente para ativar.
              </p>
            </div>
          )}
        </div>

        {/* Google Sheets Card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">Google Sheets</h2>
            </div>
            {sheetsSecretConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <CheckCircle2 className="h-3 w-3" />
                Webhook ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                <AlertTriangle className="h-3 w-3" />
                Secret não configurado
              </span>
            )}
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">URL do Webhook:</p>
              <code className="block rounded bg-muted p-2 text-xs break-all">
                {webhookUrl}
              </code>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Instruções para Google Apps Script:</p>
              <ol className="ml-4 list-decimal space-y-1 text-xs">
                <li>Abra o Google Sheets e vá em Extensões &gt; Apps Script</li>
                <li>Crie uma função que envia POST para a URL acima</li>
                <li>
                  Inclua o header{" "}
                  <code className="rounded bg-muted px-1 font-mono">x-webhook-secret</code>{" "}
                  com o valor da variável <code className="rounded bg-muted px-1 font-mono">GOOGLE_SHEETS_WEBHOOK_SECRET</code>
                </li>
                <li>
                  Formato do body:{" "}
                  <code className="rounded bg-muted px-1 font-mono">
                    {`{ "rows": [{ "format": "ugc_masc", "projectId": 1, "platform": "meta", "videoLink": "..." }] }`}
                  </code>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
