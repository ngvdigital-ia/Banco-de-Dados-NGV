import { ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { SYSTEM_DIRECTORY } from "@/lib/operacao/system-directory";
import { fetchSpyModuleEstado } from "@/lib/sistemas/spy/estado-client.mjs";
import { SpyEstadoView } from "@/components/sistemas/spy/spy-estado-view";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router prioriza segmento
// estático sobre dinâmico) — mesmo padrão de src/app/(dashboard)/sistemas/quiz/page.tsx (ADR
// docs/NGV-BANCO-MODULOS-FUNDACAO-ADR.md, Decisão 1). Fase 3: SOMENTE LEITURA — histórico de
// leituras e ofertas prontas pra modelar, direto do adapter server-to-server. Nenhuma mutação
// (registrar/editar/apagar leitura, cadastrar/remover oferta) existe nesta etapa — a capacidade
// `mutate` do módulo continua com allowlist vazia de propósito (Decisão 2). `SISTEMAS_SPY_MODULE_
// ENABLED` é o rollback: desligada (ou ausente), a rota volta ao EmptyState e NUNCA chama o Spy.
export const dynamic = "force-dynamic";

const isSpyModuleEnabled = () => process.env.SISTEMAS_SPY_MODULE_ENABLED === "true";

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

  return <SpyEstadoView result={result} />;
}
