// Cliente HTTP minimalista para ClickUp API v2

const BASE_URL = "https://api.clickup.com/api/v2";

export interface ClickUpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string | boolean | number>;
}

function getToken(): string {
  const API_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!API_TOKEN) {
    throw new Error("CLICKUP_API_TOKEN ausente em env");
  }
  return API_TOKEN;
}

export async function clickupFetch<T = unknown>(
  path: string,
  options: ClickUpRequestOptions = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, String(v));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: getToken(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`ClickUp API timeout (10s) on ${path}`);
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `ClickUp API error ${res.status} on ${path}: ${text.slice(0, 300)}`,
    );
  }

  return res.json() as Promise<T>;
}
