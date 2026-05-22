// Notificação de rejeição de produto dos agentes.
//
// O Banco NÃO fala com o Slack diretamente: ele dispara um webhook do n8n
// ("NGV - Notificacao Rejeicao Agentes"), que posta no #triagem-ngv usando a
// credencial "Slack NGV" (Bot Token) que já vive no n8n. Assim nenhum secret
// de Slack precisa existir aqui.

export interface RejectionNotification {
  task_id: string;
  agent: "black" | "white";
  feedback: string;
  user_email: string;
  oferta_nome: string;
  clickup_url: string;
}

/**
 * Dispara a notificação de rejeição via webhook n8n. Lança em caso de erro —
 * o chamador (approvals route) envolve em try/catch para que a falha não
 * invalide o approval já gravado no banco.
 */
export async function notifyRejectionViaN8n(
  payload: RejectionNotification,
): Promise<void> {
  const url = process.env.N8N_NOTIF_REJEICAO_WEBHOOK_URL;
  if (!url) {
    console.warn(
      "N8N_NOTIF_REJEICAO_WEBHOOK_URL ausente — notificação Slack pulada",
    );
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `n8n notif webhook ${res.status}: ${text.slice(0, 200)}`,
    );
  }
}
