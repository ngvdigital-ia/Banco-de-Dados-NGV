import { requireModuleAccess } from "@/lib/sistemas/authz";
import { fetchQuizModuleAnalytics } from "@/lib/sistemas/quiz/analytics-client.mjs";
import { listQuizDashboardProjects } from "@/lib/sistemas/quiz/projects";
import { QuizAnalyticsView } from "@/components/sistemas/quiz/quiz-analytics-view";
import { parseQuizFunnel } from "@/components/sistemas/quiz/funnel";
import { parsePeriodKey, resolvePeriod } from "@/components/sistemas/quiz/period";
import type { QuizDashboardProject } from "@/lib/sistemas/quiz/projects-client.mjs";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router
// prioriza segmento estático sobre dinâmico). A lista de projetos é a fonte de
// verdade para o seletor: a página nunca escolhe ou exibe um funil fixo.
export const dynamic = "force-dynamic";

export default async function QuizModulePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireModuleAccess("quiz", "read");

  const params = await searchParams;
  const periodParam = typeof params.period === "string" ? params.period : undefined;
  const customFromParam = typeof params.from === "string" ? params.from : undefined;
  const customToParam = typeof params.to === "string" ? params.to : undefined;
  // `funnel` é lido apenas como compatibilidade para bookmarks antigos; novas
  // navegações escrevem `project`, que é o identificador canônico da lista.
  const projectParam = typeof params.project === "string"
    ? params.project
    : typeof params.funnel === "string"
      ? params.funnel
      : undefined;
  const parsedProject = parseQuizFunnel(projectParam);
  const range = resolvePeriod(periodParam, customFromParam, customToParam);
  // Render não passa por Server Action: listarFunisQuizAction audita cada uso e
  // portanto escreve no Banco. Esta leitura direta continua server-only e só
  // acontece após o guard, sem registrar nem produzir efeitos colaterais.
  const projectsResult = await listQuizDashboardProjects();

  const selectedProject = projectsResult.kind === "success"
    ? projectsResult.data.projects.find((project: QuizDashboardProject) => project.projectId === parsedProject) ?? projectsResult.data.projects[0]
    : undefined;
  const projectNotFound = Boolean(projectParam) && (!parsedProject || !selectedProject || selectedProject.projectId !== parsedProject);

  const result = selectedProject
    ? await fetchQuizModuleAnalytics({
      projectId: selectedProject.projectId,
      funnelId: selectedProject.funnelId,
      from: range.from ?? undefined,
      to: range.to ?? undefined,
    })
    : null;

  return (
    <QuizAnalyticsView
      result={result}
      projectsResult={projectsResult}
      selectedProject={selectedProject}
      period={parsePeriodKey(periodParam)}
      customFrom={customFromParam}
      customTo={customToParam}
      projectNotFound={projectNotFound}
    />
  );
}
