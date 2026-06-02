"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Ban, RotateCcw, Trash2, Mail, XCircle, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TeamMember, TeamInvitation } from "@/lib/clerk-team";

type Props = {
  currentUserId: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
};

export function TeamManagementClient({ currentUserId, members, invitations }: Props) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function callAction(
    label: string,
    fn: () => Promise<Response>,
  ): Promise<boolean> {
    setError(null);
    setPendingAction(label);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Erro ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleBan(m: TeamMember) {
    if (!confirm(`Banir ${m.email}? Login será bloqueado mas dados ficam preservados (reversível).`)) return;
    const ok = await callAction(`ban-${m.id}`, () =>
      fetch(`/api/admin-ui/team/users/${m.id}?action=ban`, { method: "POST" }),
    );
    if (ok) refresh();
  }

  async function handleUnban(m: TeamMember) {
    const ok = await callAction(`unban-${m.id}`, () =>
      fetch(`/api/admin-ui/team/users/${m.id}?action=unban`, { method: "POST" }),
    );
    if (ok) refresh();
  }

  async function handleDelete(m: TeamMember) {
    const ok = await callAction(`delete-${m.id}`, () =>
      fetch(`/api/admin-ui/team/users/${m.id}`, { method: "DELETE" }),
    );
    if (ok) {
      setConfirmDelete(null);
      refresh();
    }
  }

  async function handleRevokeInvite(invId: string) {
    if (!confirm("Revogar convite?")) return;
    const ok = await callAction(`revoke-${invId}`, () =>
      fetch(`/api/admin-ui/team/invitations/${invId}`, { method: "DELETE" }),
    );
    if (ok) refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Gerenciar equipe</h1>
          <p className="text-sm text-muted-foreground">
            Adicione, bania ou remova membros que têm acesso ao dashboard.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Adicionar membro
        </Button>
      </div>

      {/* Banner de erro */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-muted px-4 py-3 text-sm text-danger-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Convites pendentes */}
      {invitations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Convites pendentes
            </h2>
            <span className="tabular-nums text-xs text-muted-foreground/60">
              ({invitations.length})
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border shadow-sm ring-1 ring-foreground/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Enviado em
                  </th>
                  <th className="w-16 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    className={`border-t border-border transition-colors duration-150 hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Mail className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="font-medium">{inv.emailAddress}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.id)}
                        disabled={pendingAction === `revoke-${inv.id}`}
                        aria-label={`Revogar convite para ${inv.emailAddress}`}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Membros ativos */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Membros
          </h2>
          <span className="tabular-nums text-xs text-muted-foreground/60">
            ({members.length})
          </span>
          <div className="flex-1 border-t border-border" />
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-4">
            <EmptyState
              icon={Users}
              title="Nenhum membro ainda"
              description="Convide pessoas para dar acesso ao dashboard."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border shadow-sm ring-1 ring-foreground/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Último login
                  </th>
                  <th className="w-32 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => {
                  const isSelf = m.id === currentUserId;
                  const last = m.lastSignInAt
                    ? new Date(m.lastSignInAt).toLocaleDateString("pt-BR")
                    : "nunca";
                  return (
                    <tr
                      key={m.id}
                      className={`border-t border-border transition-colors duration-150 hover:bg-muted/30 ${m.banned ? "opacity-60" : ""} ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-xs text-foreground/80">
                            {m.email ?? "(sem email)"}
                          </span>
                          {isSelf && (
                            <StatusBadge variant="info" className="text-[10px] px-1.5 py-0">
                              você
                            </StatusBadge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {m.banned ? (
                          <StatusBadge variant="danger">BANIDO</StatusBadge>
                        ) : (
                          <StatusBadge variant="success">ATIVO</StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                        {last}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {m.banned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnban(m)}
                              disabled={pendingAction === `unban-${m.id}` || isSelf}
                              title="Desbanir"
                              aria-label={`Desbanir ${m.email}`}
                              className="text-muted-foreground hover:text-success"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBan(m)}
                              disabled={pendingAction === `ban-${m.id}` || isSelf}
                              title="Banir (reversível)"
                              aria-label={`Banir ${m.email}`}
                              className="text-muted-foreground hover:text-warning"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(m)}
                            disabled={isSelf}
                            title="Excluir definitivamente"
                            aria-label={`Excluir ${m.email}`}
                            className="text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dialogs */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSent={refresh}
        setError={setError}
      />

      <Dialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir membro definitivamente</DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              <strong className="text-foreground">{confirmDelete?.email}</strong> perderá acesso ao
              dashboard e seu registro Clerk será deletado.{" "}
              <span className="font-semibold text-danger">
                Esta ação não pode ser desfeita.
              </span>{" "}
              Se quiser apenas bloquear o login preservando dados, use o botão Banir.
            </p>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={pendingAction === `delete-${confirmDelete?.id}`}
            >
              {pendingAction === `delete-${confirmDelete?.id}` ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onSent,
  setError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent: () => void;
  setError: (s: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("Email inválido");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin-ui/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Erro ${res.status}`);
          return;
        }
        setEmail("");
        onOpenChange(false);
        onSent();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao enviar convite");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar novo membro</DialogTitle>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Clerk envia um email pro convidado se cadastrar. Ele só consegue entrar
            depois de criar a senha.
          </p>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Email
          </Label>
          <Input
            type="email"
            placeholder="nome@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="font-mono text-sm"
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !email.trim()}>
            {isPending ? "Enviando…" : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
