// Tipos de domínio compartilhados entre wrappers e UI

export type AgenteTipo = "black" | "white" | "triagem";

export type EstadoAgente =
  | "pra_hoje"
  | "pra_amanha"
  | "em_execucao"
  | "executada";

export type OfertaStatus =
  | "rascunho"
  | "em_andamento"
  | "finalizada"
  | "arquivada";

// Representação agregada de uma oferta (composta a partir das 3 fontes)
export interface Oferta {
  task_id: string; // ClickUp task pai
  nome: string;
  nicho?: string;
  idioma?: string;
  documento_principal_url?: string;
  status_clickup: string; // status atual da task pai
  subs_status: SubsStatus;
  agentes: {
    black: AgenteEstado;
    white: AgenteEstado;
  };
  atualizado_em: string; // ISO timestamp
}

export interface SubsStatus {
  escrita_vsl?: string;
  revisao_diogo?: string;
  pagina_vsl_vturb?: string;
  traducao_vsl?: string;
  // outras subs irrelevantes pro estado de gatilho — incluir apenas se quisermos exibir
}

export interface AgenteEstado {
  estado: EstadoAgente;
  execution?: ExecutionInfo; // se em execução
  produto?: ProdutoInfo; // se executada
  approval?: ApprovalInfo; // se já foi aprovada/rejeitada por um user
  ultima_atividade?: string;
}

export interface ApprovalInfo {
  id: string;
  action: "approved" | "rejected"; // bate com check da tabela approvals
  feedback?: string;
  feedback_audio_url?: string;
  user_email: string;
  created_at: string;
}

export interface ExecutionInfo {
  exec_id: string;
  workflow_id: string;
  status: "running" | "success" | "error" | "waiting";
  started_at: string;
  duration_seconds?: number;
  session_id?: string; // Anthropic Managed Agent session
}

export interface ProdutoInfo {
  drive_file_id?: string;
  drive_url?: string;
  drive_filename?: string;
  revisor_aprovado?: boolean;
  revisor_score?: number;
}
