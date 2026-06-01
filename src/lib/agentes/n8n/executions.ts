import { n8nFetch } from "./client";
import { getTask } from "@/lib/agentes/clickup/tasks";

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: "running" | "success" | "error" | "waiting" | "canceled";
  finished: boolean;
  startedAt: string;
  stoppedAt?: string;
  data?: unknown;
}

export interface ListExecutionsParams {
  workflowId?: string;
  status?: N8nExecution["status"];
  limit?: number;
  includeData?: boolean;
}

export async function listExecutions(
  params: ListExecutionsParams = {},
): Promise<N8nExecution[]> {
  const searchParams: Record<string, string> = {};
  if (params.workflowId) searchParams.workflowId = params.workflowId;
  if (params.status) searchParams.status = params.status;
  searchParams.limit = String(params.limit ?? 20);
  searchParams.includeData = String(params.includeData ?? false);

  const response = await n8nFetch<{ data: N8nExecution[] }>("/executions", {
    searchParams,
  });
  return response.data;
}

export async function getExecution(execId: string): Promise<N8nExecution> {
  return n8nFetch<N8nExecution>(`/executions/${execId}`, {
    searchParams: { includeData: "true" },
  });
}

interface RunDataMap {
  [nodeName: string]: Array<{
    data?: { main?: Array<Array<{ json?: unknown }>> };
  }>;
}

function getNodeJson(
  runData: RunDataMap,
  nodeName: string,
): Record<string, unknown> | undefined {
  const out = runData[nodeName]?.[0]?.data?.main?.[0]?.[0]?.json;
  return out as Record<string, unknown> | undefined;
}

/**
 * Extrai o task_id da OFERTA-PAI (ClickUp) a partir de uma execução n8n.
 *
 * Os triggers passam subtask_id, então essa função sempre resolve até o parent.
 *
 * Estratégia:
 *   1. Buscar tarefa-mãe — output é a task pai (id direto)
 *   2. PostFilter: nome bate? — output expõe parent_task_id
 *   3. ClickUp Trigger → task_id (subtask); resolver parent via cache ou API
 *   4. Webhook manual → body.task_id; resolver parent
 *
 * @param execId
 * @param parentTaskIds Set opcional de ids de ofertas-pai conhecidas.
 *   Se passado, evita chamada extra ao ClickUp quando o id já é pai.
 */
/**
 * Filtra execucoes que passaram do PreFilter (rodaram de verdade).
 * PreFilter do ClickUp Trigger encerra em ~1-2s com 2-4 nodes.
 * Critério: duração >= 30s OU > 5 nodes executados (se data presente).
 */
export function filterRealExecutions(execs: N8nExecution[]): N8nExecution[] {
  return execs.filter((e) => {
    if (!e.stoppedAt) return true; // running ainda
    const durMs =
      new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime();
    if (durMs >= 30_000) return true;
    const runData = (e.data as { resultData?: { runData?: object } } | undefined)
      ?.resultData?.runData;
    if (runData && Object.keys(runData).length > 5) return true;
    return false;
  });
}

/**
 * Lista execucoes SUCCESS recentes que passaram do PreFilter,
 * mapeadas por task_id da oferta-pai.
 */
export async function getRealExecutionsByTaskId(
  workflowId: string,
  parentTaskIds?: Set<string>,
  limit: number = 50,
): Promise<Map<string, N8nExecution>> {
  const execs = await listExecutions({
    workflowId,
    status: "success",
    limit,
    includeData: false,
  });
  // Filtro inicial só por duração (data ainda não veio)
  const reais = filterRealExecutions(execs);
  const map = new Map<string, N8nExecution>();

  // Processar em lotes de 10 para evitar avalanche de requisições simultâneas
  const BATCH_SIZE = 10;
  for (let i = 0; i < reais.length; i += BATCH_SIZE) {
    const lote = reais.slice(i, i + BATCH_SIZE);
    await Promise.all(
      lote.map(async (e) => {
        try {
          const taskId = await getTaskIdFromExecution(e.id, parentTaskIds);
          if (taskId) map.set(taskId, e);
        } catch (err) {
          console.error(
            `[getRealExecutionsByTaskId] erro pra exec ${e.id}:`,
            (err as Error).message,
          );
        }
      }),
    );
  }

  return map;
}

/**
 * Extrai dados do Revisor v1 a partir de uma execução do Black.
 * Procura o nó "Parse Revisor v1" (ou retry / nó Anthropic direto) no runData
 * e retorna score + aprovado se disponíveis.
 */
export async function extractRevisorDataFromExecution(
  execId: string,
): Promise<{ score?: number; aprovado?: boolean } | null> {
  try {
    const exec = await getExecution(execId);
    const runData = (
      exec.data as { resultData?: { runData?: RunDataMap } } | undefined
    )?.resultData?.runData;
    if (!runData) return null;

    const nodeCandidates = [
      "Parse Revisor v1 RETRY",
      "Parse Revisor v1",
      "Revisor v1 (Sonnet)",
    ];

    for (const nodeName of nodeCandidates) {
      const nodeOutput = getNodeJson(runData, nodeName);
      if (!nodeOutput) continue;

      // Parse Revisor é tipicamente o JSON do schema (aprovado, score, criterios)
      // Anthropic nó pode trazer { content: [...] } ou similar
      const candidate =
        (nodeOutput as { aprovado?: unknown }).aprovado !== undefined
          ? nodeOutput
          : ((nodeOutput as { body?: unknown }).body as
              | Record<string, unknown>
              | undefined) ?? nodeOutput;

      const score = candidate.score;
      const aprovado = candidate.aprovado;

      if (typeof score === "number" || typeof aprovado === "boolean") {
        return {
          score: typeof score === "number" ? score : undefined,
          aprovado: typeof aprovado === "boolean" ? aprovado : undefined,
        };
      }
    }

    return null;
  } catch (err) {
    console.error(`Falha ao extrair Revisor de exec ${execId}:`, err);
    return null;
  }
}

/**
 * Extrai dados de arquivos do Drive criados durante a execução do Black.
 * Procura nós de Google Drive upload e retorna URL do produto final.
 */
export async function extractDriveDataFromExecution(execId: string): Promise<{
  drive_file_id?: string;
  drive_url?: string;
  drive_filename?: string;
} | null> {
  try {
    const exec = await getExecution(execId);
    const runData = (
      exec.data as { resultData?: { runData?: RunDataMap } } | undefined
    )?.resultData?.runData;
    if (!runData) return null;

    // Nomes de nós conhecidos no workflow Black (exec 20277 confirmou estes):
    //   - "Upload Doc v1"           → produto final aprovado
    //   - "Renomear v1 → produto-black" → caso aprovação
    //   - "Mover v1 pra archive"   → caso rejeição (vai pra archive/)
    const nodeCandidates = [
      "Upload Doc v1",
      "Upload Doc v1 inicial",
      "Renomear v1 → produto-black",
      "Upload Produto Drive",
      "Upload to Drive",
      "Google Drive Upload",
    ];

    for (const nodeName of nodeCandidates) {
      const out = getNodeJson(runData, nodeName);
      if (!out) continue;
      const drive_file_id =
        (out.id as string | undefined) ?? (out.fileId as string | undefined);
      const drive_url =
        (out.webViewLink as string | undefined) ??
        (out.webContentLink as string | undefined) ??
        (out.url as string | undefined);
      const drive_filename =
        (out.name as string | undefined) ??
        (out.filename as string | undefined);
      if (drive_url) {
        return { drive_file_id, drive_url, drive_filename };
      }
    }

    // Fallback: regex no JSON inteiro
    const str = JSON.stringify(runData);
    const m = str.match(/https:\/\/drive\.google\.com\/[^\s"]+/);
    if (m) return { drive_url: m[0] };
    return null;
  } catch (err) {
    console.error(`Falha ao extrair Drive de exec ${execId}:`, err);
    return null;
  }
}

export async function getTaskIdFromExecution(
  execId: string,
  parentTaskIds?: Set<string>,
): Promise<string | null> {
  const exec = await getExecution(execId);
  const runData = (
    exec.data as { resultData?: { runData?: RunDataMap } } | undefined
  )?.resultData?.runData;
  if (!runData) return null;

  // 1. Buscar tarefa-mãe → id direto da pai
  const buscarMae = getNodeJson(runData, "Buscar tarefa-mãe");
  if (buscarMae && typeof buscarMae.id === "string") {
    return buscarMae.id;
  }

  // 2. PostFilter: nome bate? → parent_task_id explícito
  const postFilter = getNodeJson(runData, "PostFilter: nome bate?");
  if (postFilter && typeof postFilter.parent_task_id === "string") {
    return postFilter.parent_task_id;
  }

  // 3 e 4. Pegar task_id raw do trigger (pode ser subtask)
  let rawTaskId: string | undefined;

  const triggerClickUp = getNodeJson(runData, "Trigger: ClickUp Task Updated");
  if (triggerClickUp && typeof triggerClickUp.task_id === "string") {
    rawTaskId = triggerClickUp.task_id;
  }

  if (!rawTaskId) {
    const webhookManual = getNodeJson(runData, "Webhook (manual)");
    const body = webhookManual?.body as
      | { task_id?: unknown }
      | undefined;
    if (body && typeof body.task_id === "string") {
      rawTaskId = body.task_id;
    }
  }

  if (!rawTaskId) return null;

  // Se o id raw já é de uma oferta-pai conhecida, usar direto
  if (parentTaskIds && parentTaskIds.has(rawTaskId)) {
    return rawTaskId;
  }

  // Caso contrário, resolver parent via ClickUp
  try {
    const task = await getTask(rawTaskId);
    return task.parent ?? task.id;
  } catch {
    return rawTaskId;
  }
}
