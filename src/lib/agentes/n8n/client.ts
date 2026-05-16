// Cliente HTTP minimalista para n8n REST API

export interface N8nRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string>;
}

function getConfig() {
  const BASE_URL = process.env.N8N_BASE_URL;
  const API_KEY = process.env.N8N_API_KEY;
  if (!BASE_URL || !API_KEY) {
    throw new Error("N8N_BASE_URL ou N8N_API_KEY ausentes em env");
  }
  return { BASE_URL, API_KEY };
}

export async function n8nFetch<T = unknown>(
  path: string,
  options: N8nRequestOptions = {},
): Promise<T> {
  const { BASE_URL, API_KEY } = getConfig();
  const url = new URL(`/api/v1${path}`, BASE_URL);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "X-N8N-API-KEY": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `n8n API error ${res.status} on ${path}: ${text.slice(0, 300)}`,
    );
  }

  return res.json() as Promise<T>;
}
