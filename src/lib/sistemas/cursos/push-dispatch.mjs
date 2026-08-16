// Núcleo TESTÁVEL do wiring de auditoria do disparo de push do Cursos (Fase 4). Sem
// `import "server-only"` e sem importar src/lib/sistemas/audit.ts diretamente aqui —
// mesma razão de todo outro adapter .mjs desta pasta (ver push-client.mjs): precisa
// rodar via `node --test` sem side-effects de servidor. `audit.ts` arrasta `@/db`
// (Drizzle/Neon), que exige uma conexão real — este arquivo nunca toca nisso.
//
// Mesmo formato de src/lib/sistemas/authz.ts em cima de authz-core.mjs: lógica pura e
// testável aqui, wrapper "server-only" fino ao lado (push-dispatch.ts) que injeta a
// dependência real (`logModuleAction`).
//
// `logActionImpl` é OBRIGATÓRIO (sem default) de propósito — só o wrapper server-only
// tem acesso ao `logModuleAction` de verdade; testes injetam um stub.
//
// NUNCA CHAMADO POR NENHUM CAMINHO DA UI (Fase 4, decisão do operador) — o botão em
// push-campaign-form.tsx fica desabilitado e não importa nada deste arquivo nem de
// push-client.mjs::sendCursosPushCampaign. Existe pra deixar a auditoria já pronta e
// testada pro dia em que o operador ligar o disparo.

import { sendCursosPushCampaign } from "./push-client.mjs";

/**
 * Dispara a campanha (via `sendImpl`, default `sendCursosPushCampaign`) e SEMPRE
 * registra o resultado via `logActionImpl` (autor, alvo, resultado) — sucesso ou
 * falha, nunca best-effort silencioso do lado do caller: se `send` falha, o
 * `resultDetail` carrega o código/motivo, nunca fica null por omissão.
 */
export async function dispatchCursosPushCampaignWithAudit(params) {
  const { actorClerkId, actorEmail, input, logActionImpl, sendImpl } = params ?? {};
  if (typeof logActionImpl !== "function") {
    throw new TypeError("dispatchCursosPushCampaignWithAudit: logActionImpl é obrigatório");
  }
  if (typeof actorClerkId !== "string" || actorClerkId.length === 0) {
    throw new TypeError("dispatchCursosPushCampaignWithAudit: actorClerkId é obrigatório");
  }
  if (typeof actorEmail !== "string" || actorEmail.length === 0) {
    throw new TypeError("dispatchCursosPushCampaignWithAudit: actorEmail é obrigatório");
  }

  const send = sendImpl ?? sendCursosPushCampaign;
  const result = await send(input);

  const resultDetail =
    result.kind === "success" ? null : result.kind === "not_configured" ? result.reason : result.code;

  await logActionImpl({
    actorClerkId,
    actorEmail,
    module: "cursos",
    action: "push_campaign_dispatch",
    targetRef: result.kind === "success" ? result.data.id : null,
    result: result.kind === "success" ? "success" : "failure",
    resultDetail,
    payload: input,
  });

  return result;
}
