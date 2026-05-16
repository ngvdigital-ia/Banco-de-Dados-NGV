import { ClickUpTask } from "@/lib/agentes/clickup/tasks";
import { N8nExecution } from "@/lib/agentes/n8n/executions";
import { AnthropicSession } from "@/lib/agentes/anthropic/sessions";
import {
  AgenteEstado,
  AgenteTipo,
  ExecutionInfo,
} from "@/types/agentes";
import {
  extractSubsStatusBlack,
  predecessorasFinalizadasBlack,
  subGatilhoFinalizadaBlack,
} from "./subs";

interface CalculateEstadoArgs {
  oferta: ClickUpTask;
  agente: AgenteTipo;
  execsRunningPorTaskId: Map<string, N8nExecution>;
  sessionsRunning: AnthropicSession[];
  /**
   * Execs success que passaram do PreFilter (rodaram de verdade), por task_id pai.
   * Usado pelo White pra exigir prova de execução real além de sub gatilho finalizada.
   */
  execsRealizadas?: Map<string, N8nExecution>;
}

const WORKFLOW_POR_AGENTE: Record<"black" | "white", string> = {
  black: "W7odSUjobmbeaQBC",
  white: "4PGnjgJAuqQLDBHU",
};

const ANTHROPIC_AGENT_POR_TIPO: Record<"black" | "white", string> = {
  black: "agent_014LergsnxrZH5RvCnnzhfGS",
  white: "agent_01FocgmNBQz31rqZnhArZfuv",
};

export function calcularEstadoAgente(args: CalculateEstadoArgs): AgenteEstado {
  if (args.agente === "triagem") {
    return { estado: "pra_amanha" };
  }

  const { oferta, agente, execsRunningPorTaskId, sessionsRunning } = args;
  const workflowAgente = WORKFLOW_POR_AGENTE[agente];

  // 1. n8n exec running com task_id casando + workflow certo
  const execRunning = execsRunningPorTaskId.get(oferta.id);
  if (execRunning && execRunning.workflowId === workflowAgente) {
    const execInfo: ExecutionInfo = {
      exec_id: execRunning.id,
      workflow_id: execRunning.workflowId,
      status: execRunning.status as ExecutionInfo["status"],
      started_at: execRunning.startedAt,
    };
    return { estado: "em_execucao", execution: execInfo };
  }

  // 2. Anthropic session running do agente (provável match — raro >1 simultâneo)
  const sessionRunning = sessionsRunning.find(
    (s) =>
      s.agent_id === ANTHROPIC_AGENT_POR_TIPO[agente] && s.status === "running",
  );
  if (sessionRunning) {
    const execInfo: ExecutionInfo = {
      exec_id: "anthropic-only",
      workflow_id: workflowAgente,
      status: "running",
      started_at: sessionRunning.created_at,
      session_id: sessionRunning.id,
    };
    return { estado: "em_execucao", execution: execInfo };
  }

  const subs = extractSubsStatusBlack(oferta);

  // 3. Black: heurística clássica (sub gatilho finalizada = executada)
  if (agente === "black") {
    if (subGatilhoFinalizadaBlack(subs)) {
      return { estado: "executada" };
    }
    if (predecessorasFinalizadasBlack(subs)) {
      return { estado: "pra_hoje" };
    }
    return { estado: "pra_amanha" };
  }

  // 4. White: sub finalizada NÃO basta — precisa prova de execução real.
  // Como o agente White praticamente não roda (0.5% das execs reais
  // observadas), maioria com sub finalizada vai virar "pra_hoje".
  if (agente === "white") {
    const execReal = args.execsRealizadas?.get(oferta.id);

    if (subGatilhoFinalizadaBlack(subs) && execReal) {
      return {
        estado: "executada",
        ultima_atividade: execReal.stoppedAt,
      };
    }
    if (predecessorasFinalizadasBlack(subs)) {
      return { estado: "pra_hoje" };
    }
    return { estado: "pra_amanha" };
  }

  return { estado: "pra_amanha" };
}
