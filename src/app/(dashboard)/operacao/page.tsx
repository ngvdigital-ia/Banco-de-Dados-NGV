import { OperationErrorState, OperationView } from "@/components/operacao/operation-view";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { isOperationSnapshotStale, loadOperationSnapshot } from "@/lib/operacao/snapshot";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function readSnapshot() {
  try {
    const snapshot = loadOperationSnapshot();
    return { snapshot, error: null } as const;
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : "erro desconhecido" } as const;
  }
}

export default function OperacaoPage() {
  if (!isOperationCockpitEnabled) {
    redirect("/dashboard");
  }

  const result = readSnapshot();
  if (!result.snapshot) {
    console.error("Snapshot operacional inválido:", result.error);
    return <OperationErrorState affectedSources={["Snapshot versionado"]} attemptedAt={new Date().toISOString()} />;
  }
  return <OperationView snapshot={result.snapshot} stale={isOperationSnapshotStale(result.snapshot)} />;
}
