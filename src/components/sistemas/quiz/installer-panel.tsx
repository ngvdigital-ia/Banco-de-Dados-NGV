"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { QUIZ_ANALYTICS_ORIGIN } from "@/lib/sistemas/quiz/analytics-client.mjs";
import {
  ANALYTICS_ALLOWED_FUNNEL_IDS_VAR,
  ANALYTICS_ALLOWED_ORIGINS_VAR,
  ANALYTICS_ALLOWED_PROJECT_IDS_VAR,
  normalizeFunnelOrigin,
} from "@/lib/sistemas/quiz/testar-tracker-core.mjs";

// Aba "Instalar tracker" (index (1).html:17,82-95 + dashboard.js:122-149 do dashboard
// vanilla original). Origin do Quiz vem de QUIZ_ANALYTICS_ORIGIN (mesmo adapter que já serve
// as outras 4 abas) — nunca hardcoded aqui de novo, pra não divergir se o painel externo mudar
// de domínio.
//
// A tela SEMPRE mentiu por omissão: avisava "inclua o domínio na allowlist do tracker" como se
// fosse UMA allowlist, mas o servidor (quiz-analytics/server.js) recusa por TRÊS motivos
// independentes com 403 — ANALYTICS_ALLOWED_ORIGINS, ANALYTICS_ALLOWED_PROJECT_IDS,
// ANALYTICS_ALLOWED_FUNNEL_IDS —, todas env var na Vercel (não banco), exigindo redeploy. Quem
// seguia a tela cadastrava só o domínio, publicava e o painel ficava em zero pra sempre, sem
// nenhum erro visível. Esta versão: (1) mostra as TRÊS, com o valor exato de cada, a partir de
// um campo novo — o domínio da página do funil; (2) tem "testar agora" nas DUAS formas
// diferentes, cada uma dizendo o que prova e o que NÃO prova (ver testar-tracker-core.mjs pro
// porquê o teste do servidor só consegue provar a origin).
//
// kiss: não existe primitivo <Textarea> em src/components/ui hoje — mesma classe do <Input/>
// aplicada a um <textarea> nativo (mesmo atalho já usado em push-campaign-form.tsx). Extrai um
// ui/textarea.tsx se um 3º caller precisar.
const textareaClass = cn(
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs leading-relaxed transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

type AllowlistFieldResult = {
  value: string;
  checked: boolean;
  ok?: boolean;
  message: string;
};

type TestarTrackerResponse = {
  origin: AllowlistFieldResult;
  projectId: AllowlistFieldResult;
  funnelId: AllowlistFieldResult;
};

function buildTrackerSnippet(projectId: string, funnelId: string, pageId: string): string | null {
  const trimmedProject = projectId.trim();
  const trimmedFunnel = funnelId.trim();
  const trimmedPage = pageId.trim();
  if (!trimmedProject || !trimmedFunnel || !trimmedPage) return null;

  return [
    "<script",
    "  defer",
    `  src="${QUIZ_ANALYTICS_ORIGIN}/assets/tracker.js"`,
    `  data-nga-project-id="${trimmedProject}"`,
    `  data-nga-funnel-id="${trimmedFunnel}"`,
    `  data-nga-page-id="${trimmedPage}"`,
    `  data-nga-endpoint="${QUIZ_ANALYTICS_ORIGIN}/api/track"`,
    "></script>",
  ].join("\n");
}

/** As TRÊS env vars com o valor exato a colar, ou null enquanto faltar campo/domínio inválido. */
function buildAllowlistValues(projectId: string, funnelId: string, domain: string) {
  const trimmedProject = projectId.trim();
  const trimmedFunnel = funnelId.trim();
  const normalizedOrigin = normalizeFunnelOrigin(domain);
  if (!trimmedProject || !trimmedFunnel || !normalizedOrigin) return null;
  return { origin: normalizedOrigin, projectId: trimmedProject, funnelId: trimmedFunnel };
}

/**
 * Teste A ("o tracker está no ar?"): pinga tracker.js a partir do navegador do operador.
 * `no-cors` porque o servidor não manda Access-Control-Allow-Origin em assets estáticos — não
 * dá pra ler o status, só distinguir "domínio respondeu" de "falha de rede". Timeout próprio
 * pra não deixar o botão girando pra sempre.
 */
async function pingTrackerScript(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    await fetch(`${QUIZ_ANALYTICS_ORIGIN}/assets/tracker.js`, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function InstallerPanel() {
  const [projectId, setProjectId] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [pageId, setPageId] = useState("");
  const [domain, setDomain] = useState("");

  const [testAStatus, setTestAStatus] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [testBRunning, setTestBRunning] = useState(false);
  const [testBResult, setTestBResult] = useState<TestarTrackerResponse | null>(null);
  const [testBError, setTestBError] = useState<string | null>(null);

  const snippet = useMemo(() => buildTrackerSnippet(projectId, funnelId, pageId), [projectId, funnelId, pageId]);
  const allowlist = useMemo(() => buildAllowlistValues(projectId, funnelId, domain), [projectId, funnelId, domain]);
  const podeTestarB = Boolean(snippet) && Boolean(allowlist);

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const runTestA = async () => {
    setTestAStatus("running");
    const ok = await pingTrackerScript();
    setTestAStatus(ok ? "ok" : "fail");
  };

  const runTestB = async () => {
    if (!podeTestarB) return;
    setTestBRunning(true);
    setTestBResult(null);
    setTestBError(null);
    try {
      const response = await fetch("/api/sistemas/quiz/testar-tracker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, funnelId, pageId, origin: domain }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        setTestBError(typeof data?.error === "string" ? data.error : "Não foi possível testar. Tente de novo.");
        return;
      }
      setTestBResult(data as TestarTrackerResponse);
    } catch {
      setTestBError("Não foi possível falar com o painel. Confira sua conexão e tente de novo.");
    } finally {
      setTestBRunning(false);
    }
  };

  return (
    <Card className="gap-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Instalar tracker</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O mesmo <code className="rounded bg-muted px-1 py-0.5">tracker.js</code> serve todas as páginas. Informe os
          identificadores desta página e cole o trecho antes de{" "}
          <code className="rounded bg-muted px-1 py-0.5">&lt;/head&gt;</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-project">Project ID</Label>
          <Input
            id="quiz-installer-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="ex.: oferta-verao"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-funnel">Funnel ID</Label>
          <Input
            id="quiz-installer-funnel"
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            placeholder="ex.: vsl-principal"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-page">Page ID</Label>
          <Input
            id="quiz-installer-page"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="ex.: presell"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-installer-domain">Domínio da página</Label>
          <Input
            id="quiz-installer-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://roxyfox.online"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quiz-installer-snippet">Trecho de integração</Label>
        <textarea
          id="quiz-installer-snippet"
          className={cn(textareaClass, "h-32")}
          readOnly
          spellCheck={false}
          value={snippet ?? "Preencha Project ID, Funnel ID e Page ID para gerar o trecho."}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          CTA e jornada são opcionais: use <code className="rounded bg-muted px-1 py-0.5">data-nga-cta</code> nos CTAs
          e <code className="rounded bg-muted px-1 py-0.5">data-nga-journey-link</code> nos links entre domínios.
        </span>
        <Button type="button" onClick={() => snippet && copyToClipboard(snippet, "Trecho copiado")} disabled={!snippet}>
          <Copy /> Copiar trecho
        </Button>
      </div>

      {/* Peça 1: as TRÊS allowlists, nunca uma só — env var na Vercel, esta tela não cadastra. */}
      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
        <div>
          <p className="text-xs font-semibold text-foreground">Antes de publicar: 3 variáveis de ambiente na Vercel</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O tracker recusa o evento com 403 por qualquer uma das três allowlists abaixo estar sem o valor desta
            página. São <strong>env var na Vercel</strong>, não banco — esta tela só orienta e verifica, nunca
            cadastra. <strong>Adicione</strong> (sem apagar o que já existe, separado por vírgula) cada valor na
            variável correspondente e faça <strong>redeploy</strong> pra valer.
          </p>
        </div>
        {allowlist ? (
          <div className="space-y-2">
            {[
              { envVar: ANALYTICS_ALLOWED_ORIGINS_VAR, value: allowlist.origin },
              { envVar: ANALYTICS_ALLOWED_PROJECT_IDS_VAR, value: allowlist.projectId },
              { envVar: ANALYTICS_ALLOWED_FUNNEL_IDS_VAR, value: allowlist.funnelId },
            ].map((row) => (
              <div key={row.envVar} className="space-y-1">
                <Label className="font-mono text-[11px] text-muted-foreground">{row.envVar}</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded border border-input bg-background px-2 py-1.5 text-xs">
                    {row.value}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(row.value, `${row.envVar} copiado`)}
                    aria-label={`Copiar valor de ${row.envVar}`}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Preencha Project ID, Funnel ID e o domínio da página pra ver o valor exato de cada variável.
          </p>
        )}
      </div>

      {/* Peça 2: "testar agora" nas DUAS formas — cada uma dizendo o que prova e o que NÃO prova. */}
      <div className="space-y-4 rounded-md border border-border p-3">
        <p className="text-xs font-semibold text-foreground">Testar agora</p>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={runTestA} disabled={testAStatus === "running"}>
              {testAStatus === "running" ? "Testando…" : "Testar tracker.js (navegador)"}
            </Button>
            {testAStatus === "ok" ? <StatusBadge variant="success">Tracker no ar</StatusBadge> : null}
            {testAStatus === "fail" ? <StatusBadge variant="danger">Sem resposta</StatusBadge> : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Prova que o script existe e o domínio do tracker responde, a partir do seu navegador. Não prova que o
            funil está autorizado — a origem aqui é a do painel, não a da página do funil.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={runTestB} disabled={!podeTestarB || testBRunning}>
              {testBRunning ? "Testando…" : "Testar allowlist do funil (servidor)"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Faz o painel disparar uma checagem real contra o tracker usando o domínio digitado acima como origem —
            não a do painel. Só consegue confirmar ANALYTICS_ALLOWED_ORIGINS: ANALYTICS_ALLOWED_PROJECT_IDS e
            ANALYTICS_ALLOWED_FUNNEL_IDS não têm como ser verificados sem gravar um evento de verdade (o tracker não
            tem modo de teste), então continuam como pendência manual abaixo.
          </p>

          {testBError ? <p className="text-xs text-danger">{testBError}</p> : null}

          {testBResult ? (
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-start gap-2">
                <StatusBadge variant={testBResult.origin.ok ? "success" : "danger"}>
                  {testBResult.origin.ok ? "Origin liberada" : "Origin bloqueada"}
                </StatusBadge>
                <span className="text-muted-foreground">{testBResult.origin.message}</span>
              </div>
              <div className="flex items-start gap-2">
                <StatusBadge variant="neutral">Project ID — confirme manualmente</StatusBadge>
                <span className="text-muted-foreground">{testBResult.projectId.message}</span>
              </div>
              <div className="flex items-start gap-2">
                <StatusBadge variant="neutral">Funnel ID — confirme manualmente</StatusBadge>
                <span className="text-muted-foreground">{testBResult.funnelId.message}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
