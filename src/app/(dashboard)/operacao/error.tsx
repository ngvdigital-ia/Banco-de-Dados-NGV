"use client";

import { OperationErrorState } from "@/components/operacao/operation-view";

export default function OperacaoError() {
  return <OperationErrorState attemptedAt={new Date().toISOString()} />;
}
