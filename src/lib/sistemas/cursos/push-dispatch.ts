import "server-only";
import { dispatchCursosPushCampaignWithAudit as dispatchCore } from "./push-dispatch.mjs";
import type { CursosPushInput, CursosPushResult } from "./push-client.d.mts";
import { logModuleAction } from "@/lib/sistemas/audit";

export interface DispatchCursosPushCampaignParams {
  actorClerkId: string;
  actorEmail: string;
  input: CursosPushInput;
}

// Wrapper fino "server-only" em cima do núcleo testável (push-dispatch.mjs) — mesmo
// formato de src/lib/sistemas/authz.ts em cima de authz-core.mjs: só injeta a
// dependência real (`logModuleAction`, que precisa de `@/db`). Nenhuma lógica nova
// aqui — o que este wrapper faz está coberto pelos testes do núcleo em
// tests/sistemas-cursos-push-dispatch.test.mjs (com stub de logActionImpl).
//
// NUNCA CHAMADO POR NENHUM CAMINHO DA UI (Fase 4, decisão do operador). O botão em
// src/components/sistemas/cursos/push-campaign-form.tsx fica desabilitado e não
// importa esta função — só monta e valida o payload. Este arquivo existe pra deixar a
// auditoria (autor, alvo, resultado) já testada e no lugar certo: no dia em que o
// operador decidir como testar o disparo sem notificar aluno de verdade e ligar o
// botão, o único trabalho que falta é o caller real (a Server Action do botão)
// apontar pra `dispatchCursosPushCampaignWithAudit`.
export async function dispatchCursosPushCampaignWithAudit(
  params: DispatchCursosPushCampaignParams,
): Promise<CursosPushResult> {
  return dispatchCore({ ...params, logActionImpl: logModuleAction });
}
