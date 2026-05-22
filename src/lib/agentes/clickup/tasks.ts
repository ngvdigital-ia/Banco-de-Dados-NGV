import { clickupFetch } from "./client";

export interface ClickUpStatus {
  status: string;
  type?: string;
  color?: string;
  orderindex?: number;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: {
    options?: Array<{ id: string; name: string; orderindex: number }>;
  };
}

export interface ClickUpTask {
  id: string;
  custom_id?: string | null;
  name: string;
  status: ClickUpStatus;
  parent?: string | null;
  date_created: string;
  date_updated: string;
  custom_fields: ClickUpCustomField[];
  subtasks?: ClickUpTask[];
  url: string;
}

export interface ListTasksParams {
  list_id: string;
  include_closed?: boolean;
  archived?: boolean;
  subtasks?: boolean; // pega subtasks junto
  page?: number;
}

/**
 * Lista tasks de uma list ID.
 * Pra dashboard de ofertas, usar list_id da lista "Projetos de Oferta".
 */
export async function listTasksInList(
  params: ListTasksParams,
): Promise<ClickUpTask[]> {
  const sp: Record<string, string | boolean | number> = {};
  if (params.include_closed !== undefined)
    sp.include_closed = params.include_closed;
  if (params.archived !== undefined) sp.archived = params.archived;
  if (params.subtasks !== undefined) sp.subtasks = params.subtasks;
  if (params.page !== undefined) sp.page = params.page;

  const response = await clickupFetch<{ tasks: ClickUpTask[] }>(
    `/list/${params.list_id}/task`,
    { searchParams: sp },
  );
  return response.tasks;
}

/**
 * Pega detalhes de uma task com subtasks e custom_fields completos.
 */
export async function getTask(
  taskId: string,
  options: { subtasks?: boolean } = {},
): Promise<ClickUpTask> {
  return clickupFetch<ClickUpTask>(`/task/${taskId}`, {
    searchParams: {
      include_subtasks: options.subtasks ?? true,
    },
  });
}

/**
 * Helper: extrai valor de custom field por nome.
 */
export function getCustomFieldValue(
  task: ClickUpTask,
  fieldName: string,
): unknown {
  const field = task.custom_fields.find((f) => f.name === fieldName);
  if (!field) return undefined;

  // Pra dropdown, value é o orderindex — converter pra nome:
  if (
    field.type === "drop_down" &&
    field.value !== undefined &&
    field.type_config?.options
  ) {
    const opt = field.type_config.options.find(
      (o) => o.orderindex === field.value,
    );
    return opt?.name;
  }

  return field.value;
}

/**
 * Helper: encontra subtask por nome (substring match, case-insensitive).
 */
export function findSubtaskByName(
  task: ClickUpTask,
  nameSubstring: string,
): ClickUpTask | undefined {
  if (!task.subtasks) return undefined;
  return task.subtasks.find((s) =>
    s.name.toLowerCase().includes(nameSubstring.toLowerCase()),
  );
}

/**
 * Muda o status de uma task. `status` é o NOME do status como cadastrado na
 * lista (ex: "em ajustes"). Lança em caso de erro (chamador decide se ignora).
 */
export async function updateTaskStatus(
  taskId: string,
  status: string,
): Promise<void> {
  await clickupFetch(`/task/${taskId}`, {
    method: "PUT",
    body: { status },
  });
}

/**
 * Posta um comentário na task. Não notifica todos por padrão.
 */
export async function postComment(
  taskId: string,
  text: string,
): Promise<void> {
  await clickupFetch(`/task/${taskId}/comment`, {
    method: "POST",
    body: { comment_text: text, notify_all: false },
  });
}
