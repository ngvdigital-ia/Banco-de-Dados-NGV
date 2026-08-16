import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { SYSTEM_DIRECTORY } from "@/lib/operacao/system-directory";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router
// prioriza segmento estático sobre dinâmico) — ADR docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md,
// Decisão 1. Fase 1 só entrega o esqueleto autorizado; as 4 abas reais do Quiz
// (leitura via adapter server-to-server) são trabalho da Fase 2 — nada é buscado
// do Quiz aqui ainda.
export const dynamic = "force-dynamic";

export default async function QuizModulePage() {
  await requireModuleAccess("quiz", "read");

  const directory = SYSTEM_DIRECTORY.quiz;

  return (
    <div className="space-y-8">
      <PageHeader title={directory.title} description={directory.description} />
      <EmptyState
        icon={BarChart3}
        title="Módulo em construção"
        description="A identidade própria do Quiz Analytics dentro do Banco NGV chega na Fase 2 — leitura de funis, respostas, campanhas UTM e eventos recentes direto do módulo, sem depender do painel externo."
      />
    </div>
  );
}
