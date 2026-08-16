import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { SYSTEM_DIRECTORY } from "@/lib/operacao/system-directory";
import { fetchQuizModuleAnalytics } from "@/lib/sistemas/quiz/analytics-client.mjs";
import { QuizAnalyticsView } from "@/components/sistemas/quiz/quiz-analytics-view";
import { parsePeriodKey, resolvePeriod } from "@/components/sistemas/quiz/period";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router
// prioriza segmento estático sobre dinâmico) — ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md,
// Decisão 1. Fase 2: as 4 abas de leitura (funil, respostas, eventos, jornadas)
// vêm do adapter server-to-server. `SISTEMAS_QUIZ_MODULE_ENABLED` é o rollback
// previsto no ADR — desligada (ou ausente), a rota volta ao EmptyState da Fase 1
// e NUNCA chama o Quiz.
export const dynamic = "force-dynamic";

const isQuizModuleEnabled = () => process.env.SISTEMAS_QUIZ_MODULE_ENABLED === "true";

export default async function QuizModulePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireModuleAccess("quiz", "read");

  const directory = SYSTEM_DIRECTORY.quiz;

  if (!isQuizModuleEnabled()) {
    return (
      <div className="space-y-8">
        <PageHeader title={directory.title} description={directory.description} />
        <EmptyState
          icon={BarChart3}
          title="Módulo em construção"
          description="A identidade própria do Quiz Analytics dentro do Banco NGV está desligada neste ambiente — leitura de funis, respostas, campanhas UTM e eventos recentes direto do módulo, sem depender do painel externo."
        />
      </div>
    );
  }

  const params = await searchParams;
  const periodParam = typeof params.period === "string" ? params.period : undefined;
  const range = resolvePeriod(periodParam);

  const result = await fetchQuizModuleAnalytics({ from: range.from ?? undefined, to: range.to ?? undefined });

  return <QuizAnalyticsView result={result} period={parsePeriodKey(periodParam)} />;
}
