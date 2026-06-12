import { listExecutions } from "./executions";

interface MonitoredWorkflow {
  id: string;
  name: string;
  maxSilenceHours: number;
}

const MONITORED: MonitoredWorkflow[] = [
  {
    id: "c36Vk9fheEbM2Hjw",
    name: "Triagem — Relatório Diário 9h",
    maxSilenceHours: 26,
  },
  {
    id: "3xXYHqssAuPZZioC",
    name: "Resumo Diário Agentes (15h)",
    maxSilenceHours: 26,
  },
];

export interface SilentWorkflow {
  name: string;
  lastSuccessAt: string | null;
  hoursSilent: number | null;
}

export interface AgentsHealthResult {
  silent: SilentWorkflow[];
}

export async function checkAgentsHealth(): Promise<AgentsHealthResult> {
  const now = Date.now();
  const silent: SilentWorkflow[] = [];

  for (const wf of MONITORED) {
    try {
      const executions = await listExecutions({
        workflowId: wf.id,
        limit: 10,
        includeData: false,
      });

      const lastSuccess = executions.find((e) => e.status === "success");

      if (!lastSuccess) {
        // Nenhuma execução bem-sucedida nas últimas 10 — silêncio confirmado
        silent.push({ name: wf.name, lastSuccessAt: null, hoursSilent: null });
        continue;
      }

      const lastSuccessMs = new Date(lastSuccess.startedAt).getTime();
      const hoursSilent = (now - lastSuccessMs) / (1000 * 60 * 60);

      if (hoursSilent > wf.maxSilenceHours) {
        silent.push({
          name: wf.name,
          lastSuccessAt: lastSuccess.startedAt,
          hoursSilent: Math.round(hoursSilent),
        });
      }
    } catch (err) {
      console.error(
        `[checkAgentsHealth] falha ao checar workflow "${wf.name}" (${wf.id}):`,
        err,
      );
      // Tolerante: não propaga — workflow individual com falha não interrompe os demais
    }
  }

  return { silent };
}
