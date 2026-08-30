import { notFound } from "next/navigation";
import { OperationPublicationView } from "@/components/operacao/operation-publication-view";
import { requireOperationOperator } from "@/lib/operacao/authz";
import { isOperationDeploymentDomainsModuleEnabled } from "@/lib/operacao/feature";
import { readOperationCommerceReadbackProjection } from "@/lib/operacao/commerce-readback-module";
import { readOperationLifecycleEvidenceProjection } from "@/lib/operacao/lifecycle-evidence-module";
import { readOperationPublicationProjection } from "@/lib/operacao/publication-module";

export const dynamic = "force-dynamic";

export default async function PublicationModulePage() {
  // Fail closed antes de autenticar ou consultar o banco: a leitura só existe
  // quando o rollout local foi habilitado explicitamente no servidor.
  if (!isOperationDeploymentDomainsModuleEnabled) notFound();
  await requireOperationOperator();
  const [projection, lifecycle, commerce] = await Promise.all([
    readOperationPublicationProjection(),
    readOperationLifecycleEvidenceProjection(),
    readOperationCommerceReadbackProjection(),
  ]);
  return <OperationPublicationView projection={projection} lifecycle={lifecycle} commerce={commerce} />;
}
