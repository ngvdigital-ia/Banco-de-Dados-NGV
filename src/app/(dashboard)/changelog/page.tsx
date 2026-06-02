import { History, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChangeLogs } from "./actions";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const entityLabels: Record<string, string> = {
  project: "Projeto",
  team_member: "Membro",
  vsl: "VSL",
  funnel: "Funil",
  creative: "Criativo",
  campaign: "Campanha",
  tag: "Tag",
};

/** Rótulos pt-BR para chaves de campos técnicos exibidos no changelog */
const fieldLabels: Record<string, string> = {
  copyVsl: "Copy da VSL",
  copyAds: "Copy ADS",
  adsCount: "Qtd. Ads",
  headline: "Headline",
  subheadline: "Subheadline",
  offerName: "Nome da oferta",
  offerStatus: "Status da oferta",
  siteUrl: "URL do site",
  siteUrls: "URLs do site",
  niche: "Nicho",
  language: "Idioma",
  projectName: "Nome do projeto",
  projectStatus: "Status do projeto",
  campaignName: "Nome da campanha",
  campaignStatus: "Status da campanha",
  spend: "Gasto",
  revenue: "Receita",
  roas: "ROAS",
  cpa: "CPA",
  memberName: "Nome do membro",
  memberRole: "Função",
  name: "Nome",
  status: "Status",
  active: "Ativo",
  description: "Descrição",
  updatedAt: "Atualizado em",
  createdAt: "Criado em",
};

const actionMeta: Record<
  string,
  { label: string; verb: string; Icon: typeof Plus; dotClass: string; badgeClass: string }
> = {
  create: {
    label: "Criação",
    verb: "criou",
    Icon: Plus,
    dotClass: "bg-success border-success/30 shadow-success/30",
    badgeClass:
      "bg-success-muted text-success-muted-foreground border border-success",
  },
  update: {
    label: "Edição",
    verb: "editou",
    Icon: Pencil,
    dotClass: "bg-info border-info/30 shadow-info/30",
    badgeClass:
      "bg-info-muted text-info-muted-foreground border border-info",
  },
  delete: {
    label: "Exclusão",
    verb: "deletou",
    Icon: Trash2,
    dotClass: "bg-danger border-danger/30 shadow-danger/30",
    badgeClass:
      "bg-danger-muted text-danger-muted-foreground border border-danger",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateGroup(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Hoje";
  if (isSameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate<T extends { createdAt: Date | string | null }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    const key = date ? date.toLocaleDateString("pt-BR") : "Sem data";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([key, entries]) => ({
    key,
    label: entries[0]?.createdAt
      ? formatDateGroup(new Date(entries[0].createdAt!))
      : "Sem data",
    entries,
  }));
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function ChangelogPage() {
  const logs = await getChangeLogs(100);
  const groups = groupByDate(logs);

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de alterações — projetos, VSLs, funis, criativos e campanhas.
        </p>
      </div>

      {/* Estado vazio */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <History className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Nenhuma alteração registrada</h2>
          <p className="text-sm text-muted-foreground">
            Todas as mudanças em projetos, VSLs, funis, criativos e campanhas aparecerão aqui.
          </p>
        </div>
      ) : (
        /* Timeline */
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key} aria-label={`Alterações de ${group.label}`}>
              {/* Cabeçalho do grupo de data */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground select-none">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" aria-hidden="true" />
              </div>

              {/* Itens da timeline */}
              <ol className="relative space-y-0">
                {/* Linha vertical */}
                <div
                  className="absolute left-[11px] top-3 bottom-3 w-px bg-border"
                  aria-hidden="true"
                />

                {group.entries.map((log, idx) => {
                  const meta = actionMeta[log.action] ?? actionMeta.update;
                  const { Icon } = meta;
                  const changes = log.changesJson as Record<string, unknown> | null;
                  const date = log.createdAt ? new Date(log.createdAt) : null;
                  const isLast = idx === group.entries.length - 1;

                  return (
                    <li
                      key={log.id}
                      className={cn("flex gap-4 relative", !isLast && "pb-5")}
                    >
                      {/* Dot */}
                      <div
                        className={cn(
                          "relative z-10 flex-shrink-0 flex items-center justify-center",
                          "h-[23px] w-[23px] rounded-full border-2 shadow-sm",
                          meta.dotClass,
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-3 w-3 text-white" strokeWidth={2.5} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        {/* Linha principal */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                              meta.badgeClass,
                            )}
                          >
                            {meta.label}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {entityLabels[log.entityType] ?? log.entityType}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums">
                            #{log.entityId}
                          </span>
                          {date && (
                            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                              {formatTime(date)}
                            </span>
                          )}
                        </div>

                        {/* Campos alterados */}
                        {changes && Object.keys(changes).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            {Object.entries(changes).map(([key, value]) => (
                              <span
                                key={key}
                                className="text-xs text-muted-foreground"
                              >
                                <span className="text-foreground/70 font-medium">
                                  {fieldLabels[key] ?? key}
                                </span>
                                {" "}
                                <span className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">
                                  {String(value)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Ator */}
                        {log.userId && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            por{" "}
                            <span className="text-primary font-medium">
                              {log.userId.includes("@")
                                ? log.userId.split("@")[0]
                                : log.userId}
                            </span>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
