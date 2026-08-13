import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { operationCommands } from "@/db/schema";
import { requireOperationOperator } from "@/lib/operacao/authz";
import {
  isOperationCommandDispatchEnabled,
  isOperationCommandsEnabled,
} from "@/lib/operacao/feature";
import { dispatchOperationCommand } from "@/lib/operacao/command-dispatch.mjs";
import { safeParseOperationCommand } from "@/lib/operacao/command-contract.mjs";
import {
  commandDigest,
  classifyIdempotency,
  detectSensitivePayload,
  IDEMPOTENCY_NEW,
  IDEMPOTENCY_REPLAY,
  IDEMPOTENCY_CONFLICT,
} from "@/lib/operacao/command-ledger.mjs";

export const runtime = "nodejs";

const MAX_COMMAND_BODY_BYTES = 64 * 1024;

type SafeParseCommandResult = {
  success: false;
  error: {
    issues: Array<{
      path: ReadonlyArray<PropertyKey>;
      message: string;
    }>;
  };
};

type CommandAction =
  | "consult"
  | "create"
  | "edit"
  | "comment"
  | "attach"
  | "complete"
  | "reopen"
  | "approve";

function sanitizedContractError(result: SafeParseCommandResult) {
  const issues = result.error.issues.slice(0, 5).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { error: "CONTRACT_REJECTED", issues };
}

function response(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function dispatchFailure(command: OperationCommand, error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code).slice(0, 80)
    : "INTAKE_UNAVAILABLE";
  return response(503, {
    error: "COMMAND_DISPATCH_FAILED",
    code,
    command_id: command.command_id,
    dispatch: false,
  });
}

// Fail-closed de cabeçalhos: exige Content-Type application/json; quando Origin
// está presente, precisa ser same-origin com a URL da request. Origin ausente
// continua permitido (cliente interno sem origem de browser).
function validateRequestEnvelope(
  request: Request,
): { status: number; error: string } | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { status: 415, error: "UNSUPPORTED_MEDIA_TYPE" };
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return { status: 403, error: "ORIGIN_MISMATCH" };
    }
    if (originUrl.origin !== new URL(request.url).origin) {
      return { status: 403, error: "ORIGIN_MISMATCH" };
    }
  }

  return null;
}

type ReadBodyResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

// Leitura do corpo em streaming com orçamento de bytes (fail-closed): rejeita de
// cara um Content-Length declarado acima do limite e cancela o stream assim que a
// contagem estoura — nunca materializa o payload inteiro antes do limite.
async function readBodyWithBudget(
  request: Request,
  budget: number,
): Promise<ReadBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > budget) {
      return { ok: false, status: 413, error: "PAYLOAD_TOO_LARGE" };
    }
  }

  const body = request.body;
  if (!body) {
    return { ok: false, status: 400, error: "BODY_UNREADABLE" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > budget) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, error: "PAYLOAD_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "BODY_UNREADABLE" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8").decode(merged) };
}

type OperationCommand = {
  schema_version: 1;
  command_id: string;
  offer_id: string;
  actor: {
    name: string;
    clickup_user_id: number | "PENDING";
    email?: string;
  };
  action: CommandAction;
  requested_at: string;
  args: Record<string, unknown>;
};

async function dispatchAndRespond(command: OperationCommand, idempotency: "new" | "replay") {
  try {
    const receipt = await dispatchOperationCommand(command);
    if (receipt.http_status === 409) {
      return response(409, {
        error: "COMMAND_ID_COLLISION",
        command_id: command.command_id,
        action: command.action,
        dispatch: true,
        receipt,
      });
    }
    if (![200, 202].includes(receipt.http_status)) {
      return dispatchFailure(command, { code: "DISPATCH_STATUS_MISMATCH" });
    }
    return response(idempotency === "new" ? 202 : 200, {
      status: "queued",
      idempotency,
      command_id: command.command_id,
      action: command.action,
      dispatch: true,
      receipt,
    });
  } catch (error) {
    return dispatchFailure(command, error);
  }
}

export async function POST(request: Request) {
  // Fail-closed: flag server-side deve estar === "true"; ausente/false => 404.
  if (!isOperationCommandsEnabled) {
    return response(404, { error: "NOT_FOUND" });
  }

  let operator: { id: string; email: string };
  try {
    operator = await requireOperationOperator();
  } catch (error) {
    const candidate = error instanceof Error && "status" in error
      ? (error as { status: unknown }).status
      : undefined;
    const status = candidate === 401 || candidate === 403 ? candidate : 500;
    return response(status, { error: "AUTH_REJECTED" });
  }

  const envelopeError = validateRequestEnvelope(request);
  if (envelopeError) {
    return response(envelopeError.status, { error: envelopeError.error });
  }

  // Limite de corpo: 64 KiB fail-closed. Nunca materializamos o payload inteiro
  // antes de garantir o limite — Content-Length é rejeitado de cara e o corpo é
  // lido em streaming contando bytes (cancelando o stream ao estourar).
  const read = await readBodyWithBudget(request, MAX_COMMAND_BODY_BYTES);
  if (!read.ok) {
    return response(read.status, { error: read.error });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(read.text);
  } catch {
    return response(400, { error: "INVALID_JSON" });
  }

  // Detecção conservadora de secrets no raw ANTES do Zod (sem logar payload):
  // um campo segredo fora do contrato é rejeitado aqui, e nunca vira eco num
  // erro de validação contratual.
  const sensitive = detectSensitivePayload(raw);
  if (sensitive.sensitive) {
    return response(422, { error: "SENSITIVE_PAYLOAD", matches: sensitive.matches });
  }

  // Validação do contrato v1 (Zod strict + discriminação por action).
  const parsed = safeParseOperationCommand(raw);
  if (!parsed.success) {
    return response(400, sanitizedContractError(parsed));
  }
  const command = parsed.data as OperationCommand;

  // Actor (ClickUp) e operador (Clerk) são identidades separadas; se o actor
  // declara email, ele precisa bater com o operador autenticado.
  if (command.actor.email && command.actor.email.toLowerCase() !== operator.email.toLowerCase()) {
    return response(403, { error: "ACTOR_EMAIL_MISMATCH" });
  }

  // Idempotência deliberada: o digest cobre o comando canônico INTEIRO (canonical
  // JSON + sha256), não apenas o command_id. Mesmo command_id só vira replay se o
  // payload validado for exatamente equivalente; qualquer divergência => 409.
  const digest = commandDigest(command);

  const insertRow = {
    commandId: command.command_id,
    offerId: command.offer_id,
    action: command.action as (typeof operationCommands.$inferInsert)["action"],
    actorName: command.actor.name,
    actorClickupUserId:
      command.actor.clickup_user_id === "PENDING"
        ? "PENDING"
        : String(command.actor.clickup_user_id),
    operatorUserId: operator.id,
    operatorEmail: operator.email,
    payload: command as unknown as object,
    payloadHash: digest,
    status: "accepted",
    requestedAt: new Date(command.requested_at),
  } as const;

  const inserted = await db
    .insert(operationCommands)
    .values(insertRow)
    .onConflictDoNothing({ target: operationCommands.commandId })
    .returning({ id: operationCommands.id });

  if (inserted.length > 0) {
    // O adapter confirma apenas queued/receipt; não afirma execução no ClickUp.
    if (isOperationCommandDispatchEnabled) return dispatchAndRespond(command, "new");
    return response(202, {
      status: "accepted",
      idempotency: IDEMPOTENCY_NEW,
      command_id: command.command_id,
      action: command.action,
      dispatch: false,
    });
  }

  // Duplicata de command_id: idempotência por hash do payload canônico.
  const [existing] = await db
    .select({ payloadHash: operationCommands.payloadHash })
    .from(operationCommands)
    .where(eq(operationCommands.commandId, command.command_id))
    .limit(1);

  const idempotency = classifyIdempotency({
    existingHash: existing?.payloadHash,
    incomingHash: digest,
  });

  if (idempotency === IDEMPOTENCY_REPLAY) {
    if (isOperationCommandDispatchEnabled) return dispatchAndRespond(command, "replay");
    return response(200, {
      status: "replay",
      idempotency: IDEMPOTENCY_REPLAY,
      command_id: command.command_id,
      action: command.action,
      dispatch: false,
    });
  }

  if (idempotency === IDEMPOTENCY_CONFLICT) {
    return response(409, {
      error: "COMMAND_ID_CONFLICT",
      command_id: command.command_id,
      action: command.action,
    });
  }

  return response(500, { error: "IDEMPOTENCY_UNRESOLVED" });
}
