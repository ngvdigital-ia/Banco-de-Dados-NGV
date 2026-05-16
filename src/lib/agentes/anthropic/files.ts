import { anthropicFetch } from "./client";

export interface AnthropicFile {
  id: string;
  type: "file";
  filename: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

/**
 * Lista arquivos vinculados a uma session (scope_id).
 * Usado pra detectar se produto-black.md ou produto-white.md foi gerado.
 */
export async function listFilesInSession(
  scopeId: string,
): Promise<AnthropicFile[]> {
  const response = await anthropicFetch<{ data: AnthropicFile[] }>("/v1/files", {
    searchParams: { scope_id: scopeId },
    useBeta: true,
  });
  return response.data;
}
