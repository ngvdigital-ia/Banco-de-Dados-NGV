import { ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { SYSTEM_DIRECTORY } from "@/lib/operacao/system-directory";
import { fetchSpyModuleEstado } from "@/lib/sistemas/spy/estado-client.mjs";
import { SpyEstadoView } from "@/components/sistemas/spy/spy-estado-view";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router prioriza segmento
// estático sobre dinâmico) — mesmo padrão de src/app/(dashboard)/sistemas/quiz/page.tsx (ADR
// docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 1). Fase 5: leitura (Fase 3) + as 3 abas de
// ESCRITA (Leitura do dia/Ofertas/Dados e critérios), via src/app/(dashboard)/sistemas/spy/
// actions.ts -> mutations.ts -> requireModuleAccess("spy","mutate") + logModuleAction — nunca
// pelo mutations-client.mjs direto. `SISTEMAS_SPY_MODULE_ENABLED` é o rollback: desligada (ou
// ausente), a rota volta ao EmptyState e NUNCA chama o Spy (leitura nem escrita).
export const dynamic = "force-dynamic";

const isSpyModuleEnabled = () => process.env.SISTEMAS_SPY_MODULE_ENABLED === "true";
// Esta rota é Server Component; só o booleano derivado segue para a UI. A variável
// continua server-only e nunca é usada para autorizar a mutation (o backend tem seu
// próprio gate em mutations.ts).
const isSpyMutationsEnabled = () => process.env.SISTEMAS_SPY_MUTATIONS_ENABLED === "true";

export default async function SpyModulePage() {
  await requireModuleAccess("spy", "read");

  const directory = SYSTEM_DIRECTORY.spy;

  if (!isSpyModuleEnabled()) {
    return (
      <div className="space-y-8">
        <PageHeader title={directory.title} description={directory.description} />
        <EmptyState
          icon={ScanSearch}
          title="Módulo em construção"
          description="A leitura do Spy Analytics dentro do Banco NGV está desligada neste ambiente — histórico de leituras e ofertas prontas pra modelar direto do módulo, sem depender do painel externo. Somente leitura nesta etapa."
        />
      </div>
    );
  }

  const result = await fetchSpyModuleEstado();

  return <SpyEstadoView result={result} mutationsEnabled={isSpyMutationsEnabled()} />;
}
