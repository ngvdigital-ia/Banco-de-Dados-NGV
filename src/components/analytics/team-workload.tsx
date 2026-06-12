"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { TeamWorkloadMember, MemberTasksResult } from "@/app/(dashboard)/analytics/actions";

// --------------------------------------------------------------------------
// Types (props do componente — tudo serializável vindo do Server Component)
// --------------------------------------------------------------------------

type TeamWorkloadProps = {
  members: TeamWorkloadMember[];
  syncedAt: string | null;
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatSyncedAt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------------------------------------------------------
// Drill-down Sheet
// --------------------------------------------------------------------------

type MemberSheetProps = {
  memberId: number;
  memberName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function MemberSheet({ memberId, memberName, open, onOpenChange }: MemberSheetProps) {
  const [data, setData] = useState<MemberTasksResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Carrega ao abrir (lazy)
  function handleOpenChange(v: boolean) {
    onOpenChange(v);
    if (v && !data && !isPending) {
      setError(null);
      startTransition(async () => {
        try {
          // Server Actions são importáveis diretamente de client components
          const { getMemberTasks } = await import("@/app/(dashboard)/analytics/actions");
          const result = await getMemberTasks(memberId);
          setData(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro ao carregar tarefas");
        }
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>{memberName}</SheetTitle>
          <SheetDescription>Tarefas abertas e concluídas recentes</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-6">
          {isPending && (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {error && !isPending && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {data && !isPending && (
            <>
              {/* Abertas */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Abertas ({data.open.length})
                </h3>
                {data.open.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.open.map((task, i) => (
                      <li
                        key={i}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm",
                          task.overdue
                            ? "border-danger bg-danger-muted"
                            : "border-border bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {task.overdue && (
                            <AlertTriangle
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-muted-foreground"
                              aria-label="Vencida"
                            />
                          )}
                          <span
                            className={cn(
                              "flex-1 font-medium",
                              task.overdue ? "text-danger-muted-foreground" : "text-foreground"
                            )}
                          >
                            {task.taskName}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {task.listName && <span>{task.listName}</span>}
                          {task.category && <span>{task.category}</span>}
                          {task.dueDate != null && (
                            <span
                              className={cn(task.overdue && "text-danger-muted-foreground font-medium")}
                            >
                              Vence {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Concluídas recentes */}
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Concluídas recentes
                </h3>
                {data.done.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída nos últimos 90 dias.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.done.map((task, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground flex-1 truncate">{task.taskName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground/70">
                          {formatDate(task.doneAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --------------------------------------------------------------------------
// Card individual de membro
// --------------------------------------------------------------------------

type MemberCardProps = {
  member: TeamWorkloadMember;
};

function MemberCard({ member }: MemberCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const topCategories = Object.entries(member.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={`Ver tarefas de ${member.memberName}`}
        className="rounded-lg border border-border bg-card text-left shadow-xs hover:border-primary/40 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 p-4 space-y-3 w-full"
      >
        {/* Nome + badge de vencidas */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
            {member.memberName}
          </span>
          {member.overdue > 0 && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-4xl border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                "border-danger bg-danger-muted text-danger-muted-foreground"
              )}
              aria-label={`${member.overdue} tarefas vencidas`}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {member.overdue} vencida{member.overdue > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Número grande de tasks abertas */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
            {member.open}
          </span>
          <span className="text-xs text-muted-foreground">abertas</span>
        </div>

        {/* Breakdown por categoria */}
        {topCategories.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {topCategories.map(([cat, n]) => `${cat} ${n}`).join(" · ")}
          </p>
        )}
      </button>

      <MemberSheet
        memberId={member.memberId}
        memberName={member.memberName}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}

// --------------------------------------------------------------------------
// Componente principal
// --------------------------------------------------------------------------

export function TeamWorkload({ members, syncedAt }: TeamWorkloadProps) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Dados de carga aparecem após a próxima sincronização (a cada 6h).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {syncedAt && (
        <p className="text-xs text-muted-foreground">
          Sincronizado em {formatSyncedAt(syncedAt)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {members.map((m) => (
          <MemberCard key={m.memberId} member={m} />
        ))}
      </div>
    </div>
  );
}
