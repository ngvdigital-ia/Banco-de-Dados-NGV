import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminAuthError } from "@/lib/admin-auth";
import {
  MAX_PROVISION_REQUEST_BYTES,
  proxyQuizDashboardProjects,
  readBoundedJsonRequest,
} from "@/lib/sistemas/quiz/funnel-proxy-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const projectIdSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64);
const pageSchema = z
  .object({
    url: z.string().trim().url().max(2048).refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password && !url.hash;
      } catch {
        return false;
      }
    }, "A URL precisa usar HTTPS sem credenciais ou fragmento."),
  })
  .strict();

const provisionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    format: z.enum(["quiz", "presell"]),
    pages: z.array(pageSchema).min(2).max(100),
  })
  .strict();

const deploymentSchema = z
  .object({
    projectId: projectIdSchema,
    finalUrl: pageSchema.shape.url,
  })
  .strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function errorFor(code: string) {
  const statusByCode: Record<string, number> = {
    MISSING_CREDENTIALS: 503,
    TIMEOUT: 504,
    NETWORK_ERROR: 502,
    UPSTREAM_ERROR: 502,
    UPSTREAM_UNAVAILABLE: 502,
    UPSTREAM_UNAUTHORIZED: 502,
    UPSTREAM_RATE_LIMITED: 503,
    UPSTREAM_REQUEST_REJECTED: 422,
    UPSTREAM_CONFLICT: 409,
    REQUEST_INVALID: 400,
    METHOD_NOT_ALLOWED: 405,
  };
  const messageByCode: Record<string, string> = {
    MISSING_CREDENTIALS: "As credenciais do Funnel Analytics não estão configuradas neste ambiente.",
    TIMEOUT: "O Funnel Analytics demorou demais para responder. Tente novamente.",
    NETWORK_ERROR: "Não foi possível falar com o Funnel Analytics. Tente novamente.",
    UPSTREAM_ERROR: "O Funnel Analytics está indisponível no momento. Tente novamente.",
    UPSTREAM_UNAVAILABLE: "O Funnel Analytics não respondeu como esperado. Tente novamente.",
    UPSTREAM_UNAUTHORIZED: "O Banco não conseguiu autenticar no Funnel Analytics. Avise um administrador.",
    UPSTREAM_RATE_LIMITED: "O Funnel Analytics recebeu muitas solicitações. Aguarde um instante e tente novamente.",
    UPSTREAM_REQUEST_REJECTED: "O Funnel Analytics recusou o funil. Revise nome, formato e páginas.",
    UPSTREAM_CONFLICT: "A confirmação não corresponde ao funil aguardando publicação. Atualize a página e confira a URL registrada.",
    REQUEST_INVALID: "O funil solicitado é inválido.",
    METHOD_NOT_ALLOWED: "Método não permitido.",
  };
  return response({ ok: false, code, error: messageByCode[code] ?? "O Funnel Analytics respondeu com um formato não reconhecido." }, statusByCode[code] ?? 502);
}

async function authorize() {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof AdminAuthError) return response({ error: err.message }, err.status);
    throw err;
  }
}

export async function GET(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const searchParams = new URL(request.url).searchParams;
  const project = searchParams.get("project");
  const legacyProjectId = searchParams.get("project_id");
  if (project !== null && legacyProjectId !== null && project !== legacyProjectId) {
    return response({ ok: false, code: "REQUEST_INVALID", error: "Os identificadores de funil não coincidem." }, 400);
  }
  const rawProjectId = project ?? legacyProjectId;
  const parsedProjectId = rawProjectId === null ? null : projectIdSchema.safeParse(rawProjectId);
  if (parsedProjectId !== null && !parsedProjectId.success) {
    return response({ ok: false, code: "REQUEST_INVALID", error: "O funil solicitado é inválido." }, 400);
  }

  const result = await proxyQuizDashboardProjects({
    method: "GET",
    projectId: parsedProjectId === null ? null : parsedProjectId.data,
  });
  return result.ok ? response({ ok: true, ...result.data }) : errorFor(result.code);
}

export async function POST(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const body = await readBoundedJsonRequest(request);
  if (body.kind === "too_large") {
    return response(
      {
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        error: `O pedido de criação excede o limite de ${Math.floor(MAX_PROVISION_REQUEST_BYTES / 1024)} KB.`,
      },
      413,
    );
  }
  if (body.kind !== "ok") {
    return response({ ok: false, code: "REQUEST_INVALID", error: "Envie um JSON válido para criar o funil." }, 400);
  }
  const parsed = provisionSchema.safeParse(body.value);
  if (!parsed.success) {
    return response({ ok: false, code: "REQUEST_INVALID", error: "Revise o nome, formato e URLs HTTPS das páginas." }, 400);
  }

  const result = await proxyQuizDashboardProjects({ method: "POST", payload: parsed.data });
  return result.ok ? response({ ok: true, ...result.data }) : errorFor(result.code);
}

export async function PATCH(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  const body = await readBoundedJsonRequest(request);
  if (body.kind === "too_large") {
    return response(
      {
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        error: `O pedido de confirmação excede o limite de ${Math.floor(MAX_PROVISION_REQUEST_BYTES / 1024)} KB.`,
      },
      413,
    );
  }
  if (body.kind !== "ok") {
    return response({ ok: false, code: "REQUEST_INVALID", error: "Envie um JSON válido para confirmar a publicação." }, 400);
  }
  const parsed = deploymentSchema.safeParse(body.value);
  if (!parsed.success) {
    return response({ ok: false, code: "REQUEST_INVALID", error: "Informe o projeto e a URL HTTPS registrados para confirmar a publicação." }, 400);
  }

  // Não buscamos finalUrl: o upstream aplica compare-and-set contra o registro
  // provisionado e devolve 409 se alguém tentar confirmar uma URL diferente.
  const result = await proxyQuizDashboardProjects({ method: "PATCH", payload: parsed.data });
  return result.ok ? response({ ok: true, ...result.data }) : errorFor(result.code);
}
