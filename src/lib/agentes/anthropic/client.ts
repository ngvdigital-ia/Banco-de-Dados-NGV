// Cliente HTTP minimalista para Anthropic API (focando em Managed Agents)

const BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

export interface AnthropicRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string>;
  useBeta?: boolean; // true pra Managed Agents endpoints
}

function getApiKey(): string {
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ausente em env");
  }
  return API_KEY;
}

export async function anthropicFetch<T = unknown>(
  path: string,
  options: AnthropicRequestOptions = {},
): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": getApiKey(),
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.useBeta) {
    headers["anthropic-beta"] = MANAGED_AGENTS_BETA;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`Anthropic API timeout (15s) on ${path}`);
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Anthropic API error ${res.status} on ${path}: ${text.slice(0, 300)}`,
    );
  }

  return res.json() as Promise<T>;
}
