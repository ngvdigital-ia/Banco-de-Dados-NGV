import {
  listExecutions,
  getTaskIdFromExecution,
  getRealExecutionsByTaskId,
  extractRevisorDataFromExecution,
  extractDriveDataFromExecution,
  N8nExecution,
} from "@/lib/agentes/n8n/executions";
import { db } from "@/db";
import { agentApprovals } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { listSessions } from "@/lib/agentes/anthropic/sessions";
import {
  listTasksInList,
  getCustomFieldValue,
  ClickUpTask,
} from "@/lib/agentes/clickup/tasks";
import { calcularEstadoAgente } from "./estado-agente";
import {
  extractSubsStatusBlack,
  subGatilhoFinalizadaBlack,
} from "./subs";
import type { ApprovalInfo, Oferta } from "@/types/agentes";

const CLICKUP_LIST_ID = "901326908721"; // PROD "Projetos de Oferta" (go-live 2026-05-23)
const WORKFLOW_BLACK = "W7odSUjobmbeaQBC";
const WORKFLOW_WHITE = "4PGnjgJAuqQLDBHU";
const ANTHROPIC_BLACK = "agent_014LergsnxrZH5RvCnnzhfGS";
const ANTHROPIC_WHITE = "agent_01FocgmNBQz31rqZnhArZfuv";

export async function aggregateOfertas(): Promise<Oferta[]> {
  // 1. Tasks do ClickUp — pais (parent==null) + subs (com parent).
  const tasksTodas: ClickUpTask[] = [];
  for (let page = 0; page < 20; page++) {
    const pageTasks = await listTasksInList({
      list_id: CLICKUP_LIST_ID,
      subtasks: true,
      archived: false,
      include_closed: true,
      page,
    });
    tasksTodas.push(...pageTasks);
    if (pageTasks.length < 100) break;
  }
  const subsPorPai = new Map<string, ClickUpTask[]>();
  for (const t of tasksTodas) {
    if (t.parent) {
      const arr = subsPorPai.get(t.parent) ?? [];
      arr.push(t);
      subsPorPai.set(t.parent, arr);
    }
  }
  const ofertasPais = tasksTodas
    .filter((t) => !t.parent)
    .map((t) => ({ ...t, subtasks: subsPorPai.get(t.id) ?? [] }));
  const parentIds = new Set(ofertasPais.map((t) => t.id));

  // 2. n8n executions running (Black + White) em paralelo
  const [execsRunningBlack, execsRunningWhite] = await Promise.all([
    listExecutions({
      workflowId: WORKFLOW_BLACK,
      status: "running",
      limit: 20,
    }),
    listExecutions({
      workflowId: WORKFLOW_WHITE,
      status: "running",
      limit: 20,
    }),
  ]);
  const execsRunning: N8nExecution[] = [
    ...execsRunningBlack,
    ...execsRunningWhite,
  ];

  // 3. Resolver task_id (oferta-pai) de cada exec running
  const execsRunningPorTaskId = new Map<string, N8nExecution>();
  await Promise.all(
    execsRunning.map(async (exec) => {
      try {
        const taskId = await getTaskIdFromExecution(exec.id, parentIds);
        if (taskId) execsRunningPorTaskId.set(taskId, exec);
      } catch (err) {
        console.error(`Falha ao extrair task_id da exec ${exec.id}:`, err);
      }
    }),
  );

  // 3b. Execs reais White (success) — pra "executada" exigir prova de exec real
  const execsRealizadasWhitePorTaskId = await getRealExecutionsByTaskId(
    WORKFLOW_WHITE,
    parentIds,
    200,
  );

  // 3c. Execs reais Black (success) — pra extrair score do Revisor + Drive URL
  const execsRealizadasBlackPorTaskId = await getRealExecutionsByTaskId(
    WORKFLOW_BLACK,
    parentIds,
    200,
  );

  // 4. Anthropic sessions running (Black + White)
  const [sessionsBlack, sessionsWhite] = await Promise.all([
    listSessions({
      agent_id: ANTHROPIC_BLACK,
      status: "running",
      limit: 20,
    }),
    listSessions({
      agent_id: ANTHROPIC_WHITE,
      status: "running",
      limit: 20,
    }),
  ]);
  const sessionsRunning = [...sessionsBlack, ...sessionsWhite];

  // 4b. Pra ofertas com Black "executada", buscar score + drive em paralelo
  const produtoMap = new Map<
    string,
    {
      revisor_score?: number;
      revisor_aprovado?: boolean;
      drive_file_id?: string;
      drive_url?: string;
      drive_filename?: string;
      execId: string;
    }
  >();
  const ofertasComExecReal = ofertasPais.filter((t) => {
    const subs = extractSubsStatusBlack(t);
    return (
      subGatilhoFinalizadaBlack(subs) &&
      execsRealizadasBlackPorTaskId.has(t.id)
    );
  });
  await Promise.all(
    ofertasComExecReal.map(async (t) => {
      const exec = execsRealizadasBlackPorTaskId.get(t.id)!;
      const [revisor, drive] = await Promise.all([
        extractRevisorDataFromExecution(exec.id),
        extractDriveDataFromExecution(exec.id),
      ]);
      produtoMap.set(t.id, {
        revisor_score: revisor?.score,
        revisor_aprovado: revisor?.aprovado,
        drive_file_id: drive?.drive_file_id,
        drive_url: drive?.drive_url,
        drive_filename: drive?.drive_filename,
        execId: exec.id,
      });
    }),
  );

  // 4c. Buscar ÚLTIMA approval por task_id no Drizzle (só Black por enquanto)
  const approvalsMap = new Map<string, ApprovalInfo>();
  try {
    const taskIds = ofertasPais.map((t) => t.id);
    if (taskIds.length > 0) {
      const rows = await db.select().from(agentApprovals)
        .where(and(inArray(agentApprovals.taskId, taskIds), eq(agentApprovals.agente, "black")))
        .orderBy(desc(agentApprovals.createdAt));
      for (const row of rows) {
        if (!approvalsMap.has(row.taskId)) {
          approvalsMap.set(row.taskId, {
            id: row.id,
            action: row.acao as "approved" | "rejected",
            feedback: row.feedback ?? undefined,
            feedback_audio_url: row.feedbackAudioUrl ?? undefined,
            user_email: row.userEmail,
            created_at: row.createdAt.toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Falha ao buscar approvals (segue sem):", err);
  }

  // 5. Montar Oferta por task pai
  const ofertas: Oferta[] = ofertasPais.map((t) => {
    const subs = extractSubsStatusBlack(t);
    return {
      task_id: t.id,
      nome: (getCustomFieldValue(t, "Nome da oferta") as string) ?? t.name,
      nicho: getCustomFieldValue(t, "Nicho") as string | undefined,
      idioma: getCustomFieldValue(t, "Idioma") as string | undefined,
      documento_principal_url: getCustomFieldValue(
        t,
        "Documento principal",
      ) as string | undefined,
      status_clickup: t.status.status,
      subs_status: subs,
      agentes: {
        black: (() => {
          const estadoBase = calcularEstadoAgente({
            oferta: t,
            agente: "black",
            execsRunningPorTaskId,
            sessionsRunning,
          });
          if (estadoBase.estado !== "executada") return estadoBase;
          const produto = produtoMap.get(t.id);
          const approval = approvalsMap.get(t.id);
          if (!produto && !approval) return estadoBase;
          return {
            ...estadoBase,
            produto: produto
              ? {
                  revisor_score: produto.revisor_score,
                  revisor_aprovado: produto.revisor_aprovado,
                  drive_file_id: produto.drive_file_id,
                  drive_url: produto.drive_url,
                  drive_filename: produto.drive_filename,
                }
              : undefined,
            approval,
          };
        })(),
        white: calcularEstadoAgente({
          oferta: t,
          agente: "white",
          execsRunningPorTaskId,
          sessionsRunning,
          execsRealizadas: execsRealizadasWhitePorTaskId,
        }),
      },
      atualizado_em: new Date().toISOString(),
    };
  });

  return ofertas;
}
