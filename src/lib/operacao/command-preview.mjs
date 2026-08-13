import {
  OPERATION_COMMAND_PENDING,
  isMutationAction,
  isReadOnlyAction,
  safeParseOperationCommand,
} from "./command-contract.mjs";

const PREVIEW_ACTOR = Object.freeze({
  name: OPERATION_COMMAND_PENDING,
  clickup_user_id: OPERATION_COMMAND_PENDING,
});

const ACTION_LABELS = Object.freeze({
  consult: "Consultar",
  create: "Criar tarefa",
  edit: "Editar tarefa",
  comment: "Comentar",
  attach: "Anexar",
  complete: "Concluir",
  reopen: "Reabrir",
  approve: "Aprovar",
});

function offerSlug(offer) {
  if (typeof offer?.offer_slug === "string" && offer.offer_slug.length > 0) return offer.offer_slug;
  if (typeof offer?.offer_id === "string") return offer.offer_id.replace(/^(?:ngv:|banco:)/, "");
  return OPERATION_COMMAND_PENDING.toLowerCase();
}
function offerId(offer) {
  return typeof offer?.offer_id === "string" && offer.offer_id.startsWith("ngv:")
    ? offer.offer_id
    : OPERATION_COMMAND_PENDING;
}

function clickUpTarget(offer) {
  const ids = offer?.external_ids?.clickup;
  return Array.isArray(ids) && typeof ids[0] === "string" && ids[0].length > 0
    ? ids[0]
    : OPERATION_COMMAND_PENDING;
}

function argsFor(action, target) {
  switch (action) {
    case "consult": return { task_id: target };
    case "create": return { list_id: OPERATION_COMMAND_PENDING };
    case "edit": return { task_id: OPERATION_COMMAND_PENDING, status: OPERATION_COMMAND_PENDING };
    case "comment": return { task_id: OPERATION_COMMAND_PENDING, body: OPERATION_COMMAND_PENDING };
    case "attach": return {
      task_id: OPERATION_COMMAND_PENDING,
      attachment_url: "PENDING",
      attachment_name: OPERATION_COMMAND_PENDING,
    };
    case "complete":
    case "reopen":
    case "approve": return { task_id: OPERATION_COMMAND_PENDING };
    default: return {};
  }
}

function sanitizeIssues(result) {
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "command",
    message: issue.message,
  }));
}

export function actionLabel(action) {
  return ACTION_LABELS[action] ?? action;
}

export function createOperationCommandPreview({ offer, action, generatedAt }) {
  const target = clickUpTarget(offer);
  const command = {
    schema_version: 1,
    command_id: `preview:${action}:${offerSlug(offer)}`,
    offer_id: offerId(offer),
    actor: PREVIEW_ACTOR,
    action,
    requested_at: generatedAt,
    args: argsFor(action, target),
  };
  const parsed = safeParseOperationCommand(command);
  const classification = isReadOnlyAction(action) ? "CONSULT" : isMutationAction(action) ? "MUTATION" : "PREVIEW";
  const issues = sanitizeIssues(parsed);

  return Object.freeze({
    classification,
    valid: parsed.success,
    can_submit: false,
    command,
    target,
    issues,
    reason: classification === "CONSULT"
      ? "Intenção de leitura externa; envio indisponível neste preview local."
      : classification === "MUTATION"
        ? "Mutação bloqueada: este preview não inclui aprovação, risco, precondição ou alvo real."
        : "Ação não reconhecida pelo contrato local; envio indisponível.",
  });
}
