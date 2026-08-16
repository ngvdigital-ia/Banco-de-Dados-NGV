import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { SYSTEM_DIRECTORY } from "@/lib/operacao/system-directory";
import { CursosPushCampaignForm } from "@/components/sistemas/cursos/push-campaign-form";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router prioriza
// segmento estático sobre dinâmico) — mesmo padrão de sistemas/quiz e sistemas/spy.
// Fase 4: a administração dos Cursos tem UMA tela e UMA ação (disparar push via
// OneSignal) — não existe leitura pra portar, não há histórico de campanhas.
// Decisão do operador: construir a infraestrutura (adapter + tela de composição +
// auditoria) e deixá-la DESLIGADA. `SISTEMAS_CURSOS_MODULE_ENABLED` é o rollback —
// desligada (ou ausente), a rota volta ao EmptyState. Mesmo QUANDO ligada, o botão de
// envio da tela permanece desabilitado (ver push-campaign-form.tsx) — esta flag só
// controla se a TELA aparece, não se o disparo real está liberado. Ligar o disparo é
// uma decisão separada e futura do operador.
export const dynamic = "force-dynamic";

const isCursosModuleEnabled = () => process.env.SISTEMAS_CURSOS_MODULE_ENABLED === "true";

export default async function CursosModulePage() {
  await requireModuleAccess("cursos", "read");

  const directory = SYSTEM_DIRECTORY.cursos;

  if (!isCursosModuleEnabled()) {
    return (
      <div className="space-y-8">
        <PageHeader title={directory.title} description={directory.description} />
        <EmptyState
          icon={Megaphone}
          title="Módulo em construção"
          description="A composição de campanhas de push da Plataforma de Cursos dentro do Banco NGV está desligada neste ambiente. Infraestrutura pronta (adapter, tela e auditoria); o disparo real segue desligado até o operador definir como testar sem notificar aluno de verdade."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={directory.title} description={directory.description} />
      <CursosPushCampaignForm />
    </div>
  );
}
