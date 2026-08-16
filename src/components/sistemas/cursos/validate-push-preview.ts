// Validação client-side, SÓ PARA FEEDBACK VISUAL da tela de composição — não é a
// autoridade sobre o payload. A autoridade é `validateCursosPushInput()` em
// src/lib/sistemas/cursos/push-client.mjs, que roda de novo (sempre) no momento real
// do disparo (quando o operador ligar essa etapa). Esta cópia é deliberadamente
// separada e client-safe (zero `process.env`, zero import do adapter) pra nunca puxar
// o módulo que lê CURSOS_PUSH_ADMIN_SECRET pro bundle do navegador — mesma
// preocupação de escopo que levou o route.ts real (plataforma_de_cursos) a repetir
// sua própria validação no client antes do POST.
//
// Mesmos códigos VALIDATE_* do adapter, pra mensagem de erro consistente entre as
// duas camadas — mas aqui coletamos TODOS os problemas de uma vez (a tela mostra a
// lista inteira), enquanto o adapter falha fechado no primeiro problema encontrado.
import type { CursosPushFormState } from "./types";

export interface PushPreviewIssue {
  field: string;
  code: string;
  message: string;
}

function isValidUrlLike(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/")) return true;
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function collectPushPreviewIssues(form: CursosPushFormState): PushPreviewIssue[] {
  const issues: PushPreviewIssue[] = [];

  if (form.title.trim().length === 0) {
    issues.push({ field: "title", code: "VALIDATE_TITLE_REQUIRED", message: "Título é obrigatório." });
  }

  if (form.launchUrl.trim().length === 0) {
    issues.push({ field: "launchUrl", code: "VALIDATE_LAUNCH_URL_REQUIRED", message: "URL de destino é obrigatória." });
  } else if (!isValidUrlLike(form.launchUrl.trim())) {
    issues.push({
      field: "launchUrl",
      code: "VALIDATE_LAUNCH_URL_INVALID",
      message: "URL de destino precisa ser absoluta (com protocolo) ou começar com \"/\".",
    });
  }

  if (form.imageUrl.trim().length > 0 && !isHttpUrl(form.imageUrl.trim())) {
    issues.push({ field: "imageUrl", code: "VALIDATE_IMAGE_URL_INVALID", message: "URL da imagem precisa ser http/https." });
  }

  form.buttons.forEach((button, index) => {
    const hasAnyValue = button.text.trim().length > 0 || button.url.trim().length > 0;
    if (!hasAnyValue) return; // linha em branco recém-adicionada — não é erro ainda
    if (button.text.trim().length === 0) {
      issues.push({ field: `buttons.${index}.text`, code: "VALIDATE_BUTTON_TEXT_REQUIRED", message: `Botão ${index + 1}: texto é obrigatório.` });
    }
    if (button.url.trim().length > 0 && !isValidUrlLike(button.url.trim())) {
      issues.push({ field: `buttons.${index}.url`, code: "VALIDATE_BUTTON_URL_INVALID", message: `Botão ${index + 1}: URL inválida.` });
    }
  });

  if (form.scheduleTime.trim().length > 0 && !SCHEDULE_TIME_RE.test(form.scheduleTime.trim())) {
    issues.push({ field: "scheduleTime", code: "VALIDATE_SCHEDULE_TIME_INVALID", message: "Agendamento precisa estar em HH:MM (24h)." });
  }

  return issues;
}
