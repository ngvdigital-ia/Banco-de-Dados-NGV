import { OperationErrorState, OperationView } from "@/components/operacao/operation-view";
import { requireOperationOperator } from "@/lib/operacao/authz";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { loadOperationSnapshot } from "@/lib/operacao/snapshot";
import { captureReadOnlySnapshot, operationHasStaleEvidence } from "@/lib/operacao/recent-offers.mjs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function readOperationSnapshot() {
  return captureReadOnlySnapshot(loadOperationSnapshot);
}

export default async function OperacaoPage() {
  if (!isOperationCockpitEnabled) {
    redirect("/dashboard");
  }

  await requireOperationOperator();
  const result = await readOperationSnapshot();
  if (!result.snapshot) {
    console.error("Falha ao consultar a operação no Banco NGV:", result.error);
    return <OperationErrorState affectedSources={["Banco NGV"]} attemptedAt={new Date().toISOString()} />;
  }
  return <OperationView snapshot={result.snapshot} stale={operationHasStaleEvidence(result.snapshot)} />;
}
