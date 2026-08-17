import { notFound } from "next/navigation";
import { SystemDetailView } from "@/components/operacao/system-detail-view";
import { AppsLookupPanel } from "@/components/sistemas/apps/apps-lookup-panel";
import { descreverEspelhoApps } from "@/components/sistemas/apps/lookup-state.mjs";
import { requireModuleAccess } from "@/lib/sistemas/authz";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";

// Rota estática, irmã do catch-all `[system]/page.tsx` (o Next.js App Router prioriza
// segmento estático sobre dinâmico) — mesmo padrão de sistemas/quiz, sistemas/spy e
// sistemas/cursos, e o nome da pasta é o SystemId, como nas três.
//
// ATENÇÃO AO SOMBREAMENTO: diferente de quiz/spy/cursos, /sistemas/apps-ofertas JÁ
// RENDERIZAVA conteúdo pelo catch-all (o case "apps-ofertas" de SystemDetailView, com os
// 4 indicadores do Core, a idade do dado e o voltar pra /operacao). Criar esta pasta
// sombreia aquele caminho, então esta página REPRODUZ o que o catch-all fazia — mesmo
// gate de flag, mesmo fetch, MESMO componente `SystemDetailView` reusado (não uma cópia)
// — e só então ACRESCENTA o bloco de lookup embaixo. Quem abre a rota continua vendo
// tudo o que via antes, mais a consulta por e-mail.
//
// Duas diferenças conscientes em relação ao catch-all, ambas sem efeito prático:
//   * authz por `requireModuleAccess("apps-ofertas", "read")` em vez de
//     `requireOperationOperator()` — é o padrão das páginas de módulo e a allowlist é a
//     MESMA lista (READ_ALLOWLIST = OPERATION_OPERATOR_EMAILS em authz-core.mjs), então
//     ninguém ganha nem perde acesso;
//   * `isSystemId(system)` não é checado porque aqui o id é literal.
export const dynamic = "force-dynamic";

export default async function AppsOfertasModulePage() {
  if (!isOperationCockpitEnabled) notFound();

  await requireModuleAccess("apps-ofertas", "read");

  const summary = await fetchNgvCoreOperationalSummary();
  if (summary.kind === "unavailable") {
    const code = "code" in summary && typeof summary.code === "string" ? summary.code : "SUMMARY_UNAVAILABLE";
    console.warn("[NGV Core] operational summary unavailable", { code });
  }

  // O aviso de completude do espelho é MEDIDO, não fixo: compara os acessos já
  // projetados no Core com os que o Apps reporta ter, e mostra a idade da leitura.
  // Sem esses números, `descreverEspelhoApps` cai no aviso fixo — nunca em silêncio.
  const espelho = descreverEspelhoApps(summary);

  return (
    <div className="space-y-8">
      <SystemDetailView system="apps-ofertas" summary={summary} />
      <AppsLookupPanel espelho={espelho} />
    </div>
  );
}
