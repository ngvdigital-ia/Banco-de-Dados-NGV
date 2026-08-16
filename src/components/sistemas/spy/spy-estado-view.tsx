import { Clock3, ShieldAlert, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatTimestamp } from "./format";
import { LeiturasPanel } from "./leituras-panel";
import { ProntasPanel } from "./prontas-panel";
import { SummaryCards } from "./summary-cards";
import type { SpyModuleEstadoResult } from "./types";

function notConfiguredMessage(reason: string | undefined) {
  switch (reason) {
    case "MISSING_CREDENTIALS":
      return "A credencial do Spy Analytics (SPY_DASHBOARD_PASSWORD) não está configurada neste ambiente.";
    default:
      return "Este ambiente ainda não tem o módulo do Spy Analytics configurado.";
  }
}

function errorMessage(code: string | undefined) {
  switch (code) {
    case "UNAUTHORIZED":
      return "O Spy recusou a credencial configurada (401/403).";
    case "RATE_LIMITED":
      return "O Spy limitou as tentativas de login (rate limit) — aguarde antes de recarregar.";
    case "LOGIN_COOKIE_MISSING":
      return "O Spy aceitou o login mas não devolveu a sessão esperada.";
    case "TIMEOUT":
      return "O Spy demorou mais que o limite seguro para responder.";
    case "UNEXPECTED_REDIRECT":
      return "O Spy respondeu com um redirecionamento, que este adapter nunca segue.";
    case "RESPONSE_SCHEMA_INVALID":
      return "O Spy respondeu com um formato que este painel não reconhece.";
    case "RESPONSE_JSON_INVALID":
      return "O Spy respondeu com um corpo que não é JSON válido.";
    case "RESPONSE_TOO_LARGE":
      return "A resposta do Spy excedeu o tamanho máximo aceito.";
    case "UPSTREAM_ERROR":
      return "O Spy retornou um erro interno.";
    case "REQUEST_INVALID":
      return "O Spy recusou a requisição.";
    case "NETWORK_ERROR":
      return "Não foi possível alcançar o Spy nesta leitura.";
    default:
      return "Não foi possível consultar o Spy nesta leitura.";
  }
}

export function SpyEstadoView({ result }: { result: SpyModuleEstadoResult }) {
  if (result.kind === "not_configured") {
    return (
      <div className="space-y-6">
        <PageHeader title="Spy Analytics" description="Ofertas monitoradas, leituras e prontas pra modelar." />
        <section className="rounded-lg border border-border bg-muted/30 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Módulo não configurado</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notConfiguredMessage(result.reason)}</p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico: {result.reason ?? "NOT_CONFIGURED"}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader title="Spy Analytics" description="Ofertas monitoradas, leituras e prontas pra modelar." />
          <StatusBadge variant="danger">Leitura indisponível</StatusBadge>
        </div>
        <section className="rounded-lg border border-danger/40 bg-danger-muted p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Não foi possível ler os dados do Spy agora</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {errorMessage(result.code)} Nenhum número abaixo foi inventado — a falha aparece como falha, não como lista vazia.
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">Diagnóstico seguro: {result.code ?? "UNKNOWN"}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Spy Analytics" description="Ofertas monitoradas, leituras e prontas pra modelar — leitura direta do módulo Spy." />
        <StatusBadge variant="success">Leitura ao vivo</StatusBadge>
      </div>

      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" aria-hidden="true" /> Consultado em {formatTimestamp(result.fetchedAt)}
      </span>

      <SummaryCards data={data} />
      <ProntasPanel data={data} />
      <LeiturasPanel data={data} />
    </div>
  );
}
