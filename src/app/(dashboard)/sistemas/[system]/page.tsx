import { notFound } from "next/navigation";
import { SystemDetailView } from "@/components/operacao/system-detail-view";
import { requireOperationOperator } from "@/lib/operacao/authz";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
import { fetchNgvCoreOperationalSummary } from "@/lib/operacao/ngv-core-summary.mjs";
import { isSystemId, SYSTEM_IDS } from "@/lib/operacao/system-directory";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SYSTEM_IDS.map((system) => ({ system }));
}

export default async function SystemPage({ params }: { params: Promise<{ system: string }> }) {
  const { system } = await params;
  if (!isOperationCockpitEnabled || !isSystemId(system)) notFound();

  await requireOperationOperator();
  const summary = await fetchNgvCoreOperationalSummary();
  if (summary.kind === "unavailable") {
    const code = "code" in summary && typeof summary.code === "string" ? summary.code : "SUMMARY_UNAVAILABLE";
    console.warn("[NGV Core] operational summary unavailable", { code });
  }

  return <SystemDetailView system={system} summary={summary} />;
}
