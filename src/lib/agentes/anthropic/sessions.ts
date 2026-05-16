import { anthropicFetch } from "./client";

export interface AnthropicSession {
  id: string;
  agent_id: string;
  status: "running" | "idle" | "expired";
  created_at: string;
  expires_at?: string;
  scope_id?: string;
  metadata?: Record<string, string>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface ListSessionsParams {
  agent_id?: string;
  status?: AnthropicSession["status"];
  limit?: number; // default 20
}

/**
 * Lista sessions do projeto Anthropic.
 * Filtros por agent_id e status são opcionais.
 */
export async function listSessions(
  params: ListSessionsParams = {},
): Promise<AnthropicSession[]> {
  const searchParams: Record<string, string> = {};
  if (params.agent_id) searchParams.agent_id = params.agent_id;
  if (params.status) searchParams.status = params.status;
  searchParams.limit = String(params.limit ?? 20);

  const response = await anthropicFetch<{ data: AnthropicSession[] }>(
    "/v1/sessions",
    { searchParams, useBeta: true },
  );
  return response.data;
}

/**
 * Pega detalhes de uma session específica.
 */
export async function getSession(sessionId: string): Promise<AnthropicSession> {
  return anthropicFetch<AnthropicSession>(`/v1/sessions/${sessionId}`, {
    useBeta: true,
  });
}
