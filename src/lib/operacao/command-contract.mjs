import { z } from "zod";

export const OPERATION_COMMANDS_SCHEMA_VERSION = 1;
export const OPERATION_COMMAND_PENDING = "PENDING";

export const OPERATION_ACTIONS = Object.freeze([
  "consult",
  "create",
  "edit",
  "comment",
  "attach",
  "complete",
  "reopen",
  "approve",
]);

export const OPERATION_MUTATION_ACTIONS = Object.freeze([
  "create",
  "edit",
  "comment",
  "attach",
  "complete",
  "reopen",
  "approve",
]);

export const OPERATION_RISK_LEVELS = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

export function isMutationAction(action) {
  return OPERATION_MUTATION_ACTIONS.includes(action);
}

export function isReadOnlyAction(action) {
  return action === "consult";
}

const dateTime = z.iso.datetime({ offset: true });

const ngvOfferId = z.string().regex(/^ngv:[a-z0-9]+(?:-[a-z0-9]+)*$/);
const pendingOrOfferId = z.union([z.literal(OPERATION_COMMAND_PENDING), ngvOfferId]);
const dueAt = z.union([dateTime, z.null()]);

const pendingOrId = z.union([z.literal(OPERATION_COMMAND_PENDING), z.string().min(1)]);
const realId = z
  .string()
  .min(1)
  .refine((value) => value !== OPERATION_COMMAND_PENDING, {
    message: "real_id: PENDING bloqueia a execução de mutação",
  });

const assignees = z
  .array(z.number().int().min(0))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "assignee_ids precisa ter valores únicos",
  });

const longText = z.string().min(1).max(20000);

const consultArgs = z
  .object({
    task_id: pendingOrId.optional(),
    list_id: pendingOrId.optional(),
  })
  .strict()
  .refine((value) => value.task_id !== undefined || value.list_id !== undefined, {
    message: "consult exige task_id ou list_id",
  });

const createArgs = z
  .object({
    list_id: realId,
    parent_id: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    assignee_ids: assignees.optional(),
    due_at: dueAt.optional(),
  })
  .strict();

const editArgs = z
  .object({
    task_id: realId,
    status: z.string().min(1).optional(),
    body: longText.optional(),
    content: longText.optional(),
    assignee_ids: assignees.optional(),
    due_at: dueAt.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.body !== undefined ||
      value.content !== undefined ||
      value.assignee_ids !== undefined ||
      Object.prototype.hasOwnProperty.call(value, "due_at"),
    { message: "edit exige ao menos um campo a alterar (status/body/content/assignee_ids)" },
  );

const commentArgs = z.object({
  task_id: realId,
  body: longText,
}).strict();

const attachArgs = z.object({
  task_id: realId,
  attachment_url: z.string().url(),
  attachment_name: z.string().min(1),
}).strict();

const taskWithReasonArgs = z.object({
  task_id: realId,
  reason: z.string().max(500).optional(),
}).strict();

const ARGS_SCHEMA_BY_ACTION = Object.freeze({
  consult: consultArgs,
  create: createArgs,
  edit: editArgs,
  comment: commentArgs,
  attach: attachArgs,
  complete: taskWithReasonArgs,
  reopen: taskWithReasonArgs,
  approve: taskWithReasonArgs,
});

const actorSchema = z.object({
  name: z.string().min(1),
  clickup_user_id: z.union([z.literal(OPERATION_COMMAND_PENDING), z.number().int().min(0)]),
  email: z.email().optional(),
}).strict();

const preconditionSchema = z.object({
  optimistic_date_updated: z.union([z.literal(OPERATION_COMMAND_PENDING), dateTime]),
  observed_status: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
}).strict();

const approvalSchema = z.object({
  required: z.boolean(),
  approved: z.boolean(),
  by: z.string().min(1).optional(),
  approved_at: dateTime.optional(),
  reason: z.string().max(500).optional(),
}).strict();

const riskSchema = z.object({
  level: z.enum(OPERATION_RISK_LEVELS),
  summary: z.string().min(1).max(500),
  acknowledged: z.boolean().optional(),
}).strict();

const metadataSchema = z.object({
  source: z.string().min(1).optional(),
  requested_by_ui: z.boolean().optional(),
  client_command_id: z.string().min(1).optional(),
}).strict();

function addSubIssues(ctx, result, basePath) {
  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: issue.code,
      path: [...basePath, ...issue.path],
      message: issue.message,
    });
  }
}

export const operationCommandSchema = z
  .object({
    schema_version: z.literal(OPERATION_COMMANDS_SCHEMA_VERSION),
    command_id: z.string().min(1).max(128),
    offer_id: pendingOrOfferId,
    actor: actorSchema,
    action: z.enum(OPERATION_ACTIONS),
    requested_at: dateTime,
    precondition: preconditionSchema.optional(),
    approval: approvalSchema.optional(),
    risk: riskSchema.optional(),
    args: z.unknown(),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .superRefine((command, ctx) => {
    const argsResult = ARGS_SCHEMA_BY_ACTION[command.action].safeParse(command.args);
    if (!argsResult.success) {
      addSubIssues(ctx, argsResult, ["args"]);
    }

    if (isMutationAction(command.action)) {
      if (command.offer_id === OPERATION_COMMAND_PENDING) {
        ctx.addIssue({
          code: "custom",
          path: ["offer_id"],
          message: "mutação exige offer_id real (ngv:<slug>); PENDING só é aceito em consult",
        });
      }
      if (!command.approval || command.approval.required !== true || command.approval.approved !== true) {
        ctx.addIssue({
          code: "custom",
          path: ["approval"],
          message: "mutação exige approval.required=true e approval.approved=true",
        });
      }
      if (!command.risk) {
        ctx.addIssue({
          code: "custom",
          path: ["risk"],
          message: "mutação exige risk com level e summary",
        });
      }
      if (
        !command.precondition
        || command.precondition.optimistic_date_updated === OPERATION_COMMAND_PENDING
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["precondition", "optimistic_date_updated"],
          message: "mutação exige precondition.optimistic_date_updated real (ISO-8601 observado)",
        });
      }
    }
  });

export function safeParseOperationCommand(raw) {
  return operationCommandSchema.safeParse(raw);
}

export function parseOperationCommand(raw) {
  return operationCommandSchema.parse(raw);
}
