import { NextResponse } from "next/server";
import { requireOperationOperator } from "@/lib/operacao/authz";
import {
  isOperationCommandStatusEnabled,
  isOperationCommandsEnabled,
} from "@/lib/operacao/feature";
import {
  displayStateForOutbox,
  fetchOperationCommandStatus,
} from "@/lib/operacao/command-status.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function authStatus(error: unknown) {
  const status = error && typeof error === "object" && "status" in error
    ? (error as { status: unknown }).status
    : undefined;
  return status === 401 || status === 403 ? status : 500;
}

function remoteFailureStatus(code: unknown) {
  switch (code) {
    case "STATUS_AUTH_FAILED":
    case "STATUS_REQUEST_INVALID":
    case "RESPONSE_ENVELOPE_MISMATCH":
    case "RESPONSE_TRANSPORT_MISMATCH":
      return 502;
    default:
      return 503;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ commandId: string }> },
) {
  // Both server-only gates fail closed, before auth and before the remote client.
  if (!isOperationCommandsEnabled || !isOperationCommandStatusEnabled) {
    return response({ error: "NOT_FOUND" }, 404);
  }

  try {
    await requireOperationOperator();
  } catch (error) {
    return response({ error: "AUTH_REJECTED" }, authStatus(error));
  }

  const { commandId } = await params;
  try {
    const result = await fetchOperationCommandStatus(commandId);
    if (!result) {
      return response({ error: "STATUS_UNAVAILABLE" }, 503);
    }
    if (result.kind === "not_found" || result.kind === "disabled") {
      return response({ error: "NOT_FOUND" }, 404);
    }
    if (result.kind !== "success" || !("operation_command_result" in result)) {
      return response({ error: "STATUS_UNAVAILABLE" }, 503);
    }

    const status = result.operation_command_result;
    return response({
      command_id: status.command_id,
      job_id: status.job_id,
      action: status.action,
      outbox_state: status.outbox_state,
      display_state: displayStateForOutbox(status.outbox_state),
      result: status.result,
      sanitized_error: status.sanitized_error,
      lease_generation: status.lease_generation,
      updated_at: status.updated_at,
      completed_at: status.completed_at,
    }, 200);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
    if (code === "COMMAND_ID_INVALID") {
      return response({ error: "INVALID_COMMAND_ID" }, 400);
    }
    return response({ error: "STATUS_UNAVAILABLE" }, remoteFailureStatus(code));
  }
}
