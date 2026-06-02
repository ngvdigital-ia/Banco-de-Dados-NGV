// Cliente HTTP pra webhook n8n "Triagem - Listar Candidatos".
// Lê as 3 planilhas (editor/copywriter/trafego) e retorna unificado.

export type VagaTriagem = "editor" | "copywriter" | "trafego";

// Classificação no Sheet vem como "MUITO BOM" (com espaço), "TALVEZ" ou "DESCARTAR".
// No frontend normalizamos pra MUITO_BOM (underscore) por consistência.
export type ClassificacaoTriagem = "MUITO_BOM" | "TALVEZ" | "DESCARTAR";

export interface CandidatoTriado {
  id: string;
  timestamp: string;
  nome: string;
  email?: string;
  vaga: VagaTriagem | string;
  classificacao: ClassificacaoTriagem | string;
  justificativa?: string;
  form_original?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

interface RawRow {
  row_number?: number;
  Numero?: unknown;
  Data?: unknown;
  Nome?: unknown;
  Email?: unknown;
  Vaga?: unknown;
  Classificacao?: unknown;
  Justificativa?: unknown;
  FormOriginal?: unknown;
  vaga_inferida?: unknown;
  [k: string]: unknown;
}

function getUrl(): string {
  const url = process.env.TRIAGEM_WEBHOOK_LISTAR_URL;
  if (!url) {
    throw new Error("TRIAGEM_WEBHOOK_LISTAR_URL ausente em env");
  }
  return url;
}

/**
 * Lista candidatos via webhook n8n.
 *
 * Robustez: webhook tem latência ~3.7s em prod (lê 3 Sheets em paralelo)
 * e cold start serverless Vercel pode abortar o fetch. Pra evitar erro
 * intermitente "Unexpected end of JSON input", aplica:
 *   - timeout explícito 8s via AbortSignal (pior caso SSR: 2 tentativas × 8s = 16s)
 *   - retry 2x com backoff exponencial (500ms, 1.5s)
 *   - guard contra body vazio
 */
export async function listCandidatos(): Promise<CandidatoTriado[]> {
  const url = getUrl();
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 8000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Webhook retornou ${res.status}: ${text.slice(0, 200)}`,
        );
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error("Webhook retornou body vazio");
      }

      const json = JSON.parse(text) as { data?: RawRow[] };
      const rows = Array.isArray(json.data) ? json.data : [];
      return rows.map(normalizarRow);
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[triagem/listCandidatos] tentativa ${attempt}/${MAX_RETRIES} falhou:`,
        lastError.message,
      );
      if (attempt < MAX_RETRIES) {
        const delayMs = 500 * Math.pow(3, attempt - 1); // 500, 1500, 4500
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw new Error(
    `Falha após ${MAX_RETRIES} tentativas: ${lastError?.message ?? "unknown"}`,
  );
}

function normalizarRow(row: RawRow): CandidatoTriado {
  const timestamp = String(row.Data ?? "");
  const nome = String(row.Nome ?? "");
  const email = row.Email ? String(row.Email) : undefined;

  // vaga_inferida é injetada pelo workflow (sabe qual sheet veio).
  // Fallback: parsear o campo Vaga literal.
  const vagaInferida = String(row.vaga_inferida ?? "").toLowerCase();
  const vaga: VagaTriagem | string = ["editor", "copywriter", "trafego"].includes(
    vagaInferida,
  )
    ? (vagaInferida as VagaTriagem)
    : String(row.Vaga ?? "");

  // Sheet escreve "MUITO BOM" (com espaço); converter pra MUITO_BOM.
  const classifRaw = String(row.Classificacao ?? "").toUpperCase().trim();
  let classificacao: ClassificacaoTriagem | string;
  if (classifRaw === "MUITO BOM" || classifRaw === "MUITO_BOM") {
    classificacao = "MUITO_BOM";
  } else if (classifRaw === "TALVEZ") {
    classificacao = "TALVEZ";
  } else if (classifRaw === "DESCARTAR") {
    classificacao = "DESCARTAR";
  } else {
    classificacao = classifRaw;
  }

  // FormOriginal vem como string JSON do Sheet.
  let formOriginal: Record<string, unknown> | undefined;
  if (typeof row.FormOriginal === "string" && row.FormOriginal.length > 0) {
    try {
      formOriginal = JSON.parse(row.FormOriginal);
    } catch {
      // ignora se não parsear
    }
  }

  const numero = row.Numero ?? row.row_number ?? "";
  const id = `${vagaInferida}-${numero}-${timestamp}`;

  return {
    id,
    timestamp,
    nome,
    email,
    vaga,
    classificacao,
    justificativa: row.Justificativa ? String(row.Justificativa) : undefined,
    form_original: formOriginal,
    raw: row,
  };
}
