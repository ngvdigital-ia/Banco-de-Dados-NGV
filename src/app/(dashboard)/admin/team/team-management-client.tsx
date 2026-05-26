"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Ban, RotateCcw, Trash2, Mail, XCircle } from "lucide-react";
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gerenciar equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione, banira ou remova membros que têm acesso ao dashboard.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            Convites pendentes ({invitations.length})
          </h2>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Enviado em</th>
                  <th className="w-24 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {inv.emailAddress}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.id)}
                        disabled={pendingAction === `revoke-${inv.id}`}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Membros ({members.length})
        </h2>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Último login</th>
                <th className="w-40 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.id === currentUserId;
                const last = m.lastSignInAt
                  ? new Date(m.lastSignInAt).toLocaleDateString("pt-BR")
                  : "nunca";
                return (
                  <tr key={m.id} className={`border-t ${m.banned ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.email ?? "(sem email)"}
                      {isSelf && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.banned ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          BANIDO
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          ATIVO
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{last}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {m.banned ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnban(m)}
                            disabled={pendingAction === `unban-${m.id}` || isSelf}
                            title="Desbanir"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBan(m)}
                            disabled={pendingAction === `ban-${m.id}` || isSelf}
                            title="Banir (reversível)"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(m)}
                          disabled={isSelf}
                          title="Excluir definitivamente"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

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
            <p className="text-sm text-muted-foreground">
              <strong>{confirmDelete?.email}</strong> perderá acesso ao dashboard e seu
              registro Clerk será deletado.{" "}
              <span className="font-semibold text-destructive">
                Esta ação não pode ser desfeita.
              </span>{" "}
              Se quiser apenas bloquear o login (preservando dados), use o botão Banir.
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
          <p className="text-sm text-muted-foreground">
            Clerk envia um email pro convidado se cadastrar. Ele só consegue entrar
            depois de criar a senha.
          </p>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="nome@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
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
