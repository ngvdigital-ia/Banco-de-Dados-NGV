import { OperationErrorState, OperationView } from "@/components/operacao/operation-view";
import { requireOperationOperator } from "@/lib/operacao/authz";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { isOperationQuizAnalyticsEnabled, isOperationSpyAnalyticsEnabled } from "@/lib/operacao/feature";
import { loadOperationSnapshot } from "@/lib/operacao/snapshot";
import { fetchQuizAnalyticsSummary } from "@/lib/operacao/quiz-analytics-summary.mjs";
import { fetchSpyAnalyticsSummary } from "@/lib/operacao/spy-analytics-summary.mjs";
import { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";
import { captureReadOnlySnapshot, operationHasStaleEvidence } from "@/lib/operacao/recent-offers.mjs";
import type { OperationOffer } from "@/lib/operacao/schema";
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
  const knownBancoOfferTrackingIds = result.snapshot.offers.flatMap((offer: OperationOffer) => offer.external_ids.banco_ngv.map(Number)).filter((id: number) => Number.isInteger(id) && id > 0);
  const [quizAnalytics, spyAnalytics, ngvCore] = await Promise.all([
    fetchQuizAnalyticsSummary({ config: { enabled: isOperationQuizAnalyticsEnabled }, knownBancoOfferTrackingIds }),
    fetchSpyAnalyticsSummary({ config: { enabled: isOperationSpyAnalyticsEnabled } }),
    fetchNgvCoreOperationalSummary(),
  ]);
  return <OperationView snapshot={result.snapshot} stale={operationHasStaleEvidence(result.snapshot)} quizAnalytics={quizAnalytics} spyAnalytics={spyAnalytics} ngvCore={ngvCore} />;
}
