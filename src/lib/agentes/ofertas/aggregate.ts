import {
  listExecutions,
  getTaskIdFromExecution,
  getRealExecutionsByTaskId,
  extractBlackDataFromExecution,
  N8nExecution,
} from "@/lib/agentes/n8n/executions";
import { db } from "@/db";
import { agentApprovals, agentProducts } from "@/db/schema";
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
import { unstable_cache } from "next/cache";

const CLICKUP_LIST_ID = "901326908721"; // PROD "Projetos de Oferta" (go-live 2026-05-23)
const WORKFLOW_BLACK = "W7odSUjobmbeaQBC";
const WORKFLOW_WHITE = "4PGnjgJAuqQLDBHU";
const ANTHROPIC_BLACK = "agent_014LergsnxrZH5RvCnnzhfGS";
const ANTHROPIC_WHITE = "agent_01FocgmNBQz31rqZnhArZfuv";

// Função interna com a lógica real — envolvida em unstable_cache abaixo.
// Revalida a cada 60s com tag "agentes-ofertas" (invalidada por revalidateTag em approvals/re-execute).
async function _aggregateOfertas(): Promise<Oferta[]> {

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

  // 3b+3c. Execs reais White + Black em paralelo (limit 50 cada)
  const [execsRealizadasWhitePorTaskId, execsRealizadasBlackPorTaskId] =
    await Promise.all([
      getRealExecutionsByTaskId(WORKFLOW_WHITE, parentIds, 50),
      getRealExecutionsByTaskId(WORKFLOW_BLACK, parentIds, 50),
    ]);

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
      // 1 único getExecution retorna Revisor + Drive (era 2 round-trips antes)
      const { revisor, drive } = await extractBlackDataFromExecution(exec.id);
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

  // 4b-persist. Upsert em lote dos produtos do Black no banco (write-through).
  // Defensivo: a tabela pode não existir em prod enquanto a migration não for aplicada.
  try {
    const rows = Array.from(produtoMap.entries()).map(([taskId, p]) => ({
      taskId,
      agente: "black" as const,
      executionId: p.execId,
      revisorScore: p.revisor_score != null ? String(p.revisor_score) : null,
      revisorAprovado: p.revisor_aprovado ?? null,
      driveFileId: p.drive_file_id ?? null,
      driveUrl: p.drive_url ?? null,
      driveFilename: p.drive_filename ?? null,
    }));
    if (rows.length > 0) {
      await db.insert(agentProducts).values(rows).onConflictDoNothing();
    }
  } catch (err) {
    console.error("agentProducts upsert falhou (segue sem):", err);
  }

  // 4b-fallback. Para ofertas-pai com subtarefa Black finalizada mas SEM entrada
  // no produtoMap (execution expirada no n8n), busca o registro mais recente do banco.
  try {
    const taskIdsSemProduto = ofertasPais
      .filter((t) => {
        const subs = extractSubsStatusBlack(t);
        return subGatilhoFinalizadaBlack(subs) && !produtoMap.has(t.id);
      })
      .map((t) => t.id);

    if (taskIdsSemProduto.length > 0) {
      const historico = await db
        .select()
        .from(agentProducts)
        .where(
          and(
            inArray(agentProducts.taskId, taskIdsSemProduto),
            eq(agentProducts.agente, "black"),
          ),
        )
        .orderBy(desc(agentProducts.createdAt));

      // Mantém apenas a linha mais recente por taskId (o select já veio ordenado desc)
      const visto = new Set<string>();
      for (const row of historico) {
        if (visto.has(row.taskId)) continue;
        visto.add(row.taskId);
        produtoMap.set(row.taskId, {
          revisor_score: row.revisorScore != null ? Number(row.revisorScore) : undefined,
          revisor_aprovado: row.revisorAprovado ?? undefined,
          drive_file_id: row.driveFileId ?? undefined,
          drive_url: row.driveUrl ?? undefined,
          drive_filename: row.driveFilename ?? undefined,
          execId: row.executionId,
        });
      }
    }
  } catch (err) {
    console.error("agentProducts fallback read falhou (segue sem):", err);
  }

  // 4c. Buscar ÚLTIMA approval por task_id+agente no Drizzle (Black e White)
  // Chave do map: `${taskId}:${agente}` — evita colisão entre Black e White da mesma oferta.
  const approvalsMap = new Map<string, ApprovalInfo>();
  try {
    const taskIds = ofertasPais.map((t) => t.id);
    if (taskIds.length > 0) {
      // .limit protege contra histórico ilimitado: 2 rows por task (1 Black + 1 White)
      // é suficiente porque o loop abaixo já guarda apenas a primeira por chave.
      const rows = await db.select().from(agentApprovals)
        .where(and(inArray(agentApprovals.taskId, taskIds), inArray(agentApprovals.agente, ["black", "white"])))
        .orderBy(desc(agentApprovals.createdAt))
        .limit(taskIds.length * 2);
      for (const row of rows) {
        const key = `${row.taskId}:${row.agente}`;
        if (!approvalsMap.has(key)) {
          approvalsMap.set(key, {
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
    // Calcular última atividade real: max(date_updated) entre pai + todas subtasks.
    // date_updated é epoch em ms como string no tipo ClickUpTask.
    const toMs = (raw: string | undefined): number | null => {
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const candidatos: (number | null)[] = [
      toMs(t.date_updated),
      ...(t.subtasks ?? []).map((s) => toMs(s.date_updated)),
    ];
    const validos = candidatos.filter((v): v is number => v !== null);
    const ultimaAtividadeEm =
      validos.length > 0
        ? new Date(Math.max(...validos)).toISOString()
        : null;

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
          const approval = approvalsMap.get(`${t.id}:black`);
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
        white: (() => {
          const estadoBase = calcularEstadoAgente({
            oferta: t,
            agente: "white",
            execsRunningPorTaskId,
            sessionsRunning,
            execsRealizadas: execsRealizadasWhitePorTaskId,
          });
          if (estadoBase.estado !== "executada") return estadoBase;
          const approval = approvalsMap.get(`${t.id}:white`);
          if (!approval) return estadoBase;
          return { ...estadoBase, approval };
        })(),
      },
      ultima_atividade_em: ultimaAtividadeEm,
      atualizado_em: new Date().toISOString(),
    };
  });

  return ofertas;
}

// Wrapper cacheado — TTL 60s, tag "agentes-ofertas" para invalidação on-demand.
export const aggregateOfertas = unstable_cache(
  _aggregateOfertas,
  ["agentes-ofertas"],
  { revalidate: 60, tags: ["agentes-ofertas"] },
);
