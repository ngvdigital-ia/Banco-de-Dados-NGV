import { notFound } from "next/navigation";
import { OperationExecutionView } from "@/components/operacao/operation-execution-view";
import { requireOperationOperator } from "@/lib/operacao/authz";
import { isOperationExecutionModuleEnabled } from "@/lib/operacao/feature";
import { readOperationExecutionProjection } from "@/lib/operacao/execution-module";

export const dynamic = "force-dynamic";

export default async function ExecutionModulePage() {
  // Fail closed antes de autenticar ou consultar o banco: flag desligada não
  // revela módulo, estado ou estrutura de recibos.
  if (!isOperationExecutionModuleEnabled) notFound();
  await requireOperationOperator();
  const projection = await readOperationExecutionProjection();
  return <OperationExecutionView projection={projection} />;
}
