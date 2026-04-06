"use server";

export async function triggerSync(endpoint: string) {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    const data = await res.json();

    if (res.ok) {
      return "Sincronizado com sucesso!";
    } else {
      return `Erro: ${data.error ?? "Falha na sincronização"}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return `Erro de rede: ${msg}`;
  }
}
