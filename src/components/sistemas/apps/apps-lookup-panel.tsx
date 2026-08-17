"use client";

import { useState } from "react";
import { AlertTriangle, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { consultarAcessoAppsAction } from "@/app/(dashboard)/sistemas/apps-ofertas/actions";
import {
  descreverEstadoProduto,
  descreverLookup,
} from "./lookup-state.mjs";
import type { EspelhoAviso, LookupTom } from "./lookup-state.mjs";
import { formatAmount, formatTimestamp, orDash } from "./format";

// Tela de consulta de acesso por e-mail (Apps, Frente B3). Fala com o Server Action
// vizinho, NUNCA com a edge function do Core direto — a credencial de ingress não pode
// chegar no browser. Ver o comentário de actions.ts.
//
// O e-mail do cliente aparece em UM lugar só: o campo que o próprio operador digitou.
// Nenhum resultado ecoa e-mail, token ou uuid de pessoa — a projeção da rota já não
// devolve nada disso, e esta tela não reintroduz.

type AccessRow = {
  offer_slug: string;
  status: string;
  purchase_platform: string | null;
  purchase_id: string | null;
  created_at: string | null;
  activated_at: string | null;
};

type PurchaseRow = {
  product_id: string | null;
  product_name: string | null;
  amount_cents: number | null;
  currency: string;
  event: string | null;
  order_id: string | null;
  catalog_group: string | null;
  created_at: string;
};

type ProductRow = {
  offer_slug: string;
  product_key: string;
  title: string;
  state: string;
};

type Resultado = { status: number; body: Record<string, unknown> };

const TOM_CLASSE: Record<LookupTom, string> = {
  neutro: "border-border bg-muted/30",
  info: "border-info/40 bg-info-muted",
  aviso: "border-warning/40 bg-warning-muted",
  erro: "border-danger/40 bg-danger-muted",
};

function rows<T>(body: Record<string, unknown>, key: string): T[] {
  const value = body[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function Aviso({
  tom,
  titulo,
  detalhe,
  icone: Icone,
}: {
  tom: LookupTom;
  titulo: string;
  detalhe: string;
  icone: typeof Info;
}) {
  return (
    <section
      className={`flex items-start gap-3 rounded-lg border p-4 ${TOM_CLASSE[tom]}`}
      role="status"
      aria-live="polite"
    >
      <Icone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{detalhe}</p>
      </div>
    </section>
  );
}

function Bloco({ titulo, total, children }: { titulo: string; total: number; children: React.ReactNode }) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <StatusBadge variant="neutral">{total} registro(s)</StatusBadge>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada nesta seção para este e-mail. Pode ser ausência real ou espelho ainda incompleto — o aviso
          no topo diz qual dos dois é mais provável agora.
        </p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </Card>
  );
}

export function AppsLookupPanel({ espelho }: { espelho: EspelhoAviso }) {
  const [email, setEmail] = useState("");
  const [fase, setFase] = useState<"idle" | "loading" | "done">("idle");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [falhou, setFalhou] = useState(false);

  async function consultar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFase("loading");
    setFalhou(false);
    try {
      const res = await consultarAcessoAppsAction(email);
      setResultado(res);
      setFalhou(false);
    } catch {
      // Erro do Server Action (rede, sessão, deploy) nunca vira tela muda.
      setResultado(null);
      setFalhou(true);
    } finally {
      setFase("done");
    }
  }

  const descricao = descreverLookup({
    fase,
    status: resultado?.status,
    body: resultado?.body,
    falhou,
  });

  const body = resultado?.body ?? {};
  const acessos = rows<AccessRow>(body, "access");
  const compras = rows<PurchaseRow>(body, "purchases");
  const produtos = rows<ProductRow>(body, "products");
  const mostrarBlocos = descricao.estado === "found" || descricao.estado === "empty";

  return (
    <div className="space-y-5">
      <Aviso
        tom={espelho.tom}
        titulo={espelho.titulo}
        detalhe={espelho.detalhe}
        icone={espelho.completo ? Info : AlertTriangle}
      />

      <Card className="gap-4 p-5">
        <form onSubmit={consultar} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="apps-lookup-email">E-mail do cliente</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="apps-lookup-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@exemplo.com"
                className="sm:max-w-md"
              />
              <Button type="submit" disabled={fase === "loading"}>
                <Search /> {fase === "loading" ? "Consultando…" : "Consultar"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use o e-mail do PAGAMENTO — costuma divergir do e-mail de contato. Somente leitura: esta tela
            não altera nada no acesso do cliente.
          </p>
        </form>
      </Card>

      <Aviso
        tom={descricao.tom}
        titulo={descricao.titulo}
        detalhe={descricao.detalhe}
        icone={descricao.tom === "erro" || descricao.tom === "aviso" ? AlertTriangle : Info}
      />

      {mostrarBlocos && (
        <>
          <Bloco titulo="Acessos" total={acessos.length}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oferta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ativado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acessos.map((row, index) => (
                  <TableRow key={`${row.offer_slug}-${row.purchase_id ?? index}`}>
                    <TableCell className="font-mono text-xs">{orDash(row.offer_slug)}</TableCell>
                    <TableCell>
                      <StatusBadge variant={row.status === "active" ? "success" : "neutral"}>
                        {orDash(row.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{orDash(row.purchase_platform)}</TableCell>
                    <TableCell className="tabular-nums">{formatTimestamp(row.created_at)}</TableCell>
                    <TableCell className="tabular-nums">{formatTimestamp(row.activated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Bloco>

          <Bloco titulo="Compras" total={compras.length}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.map((row, index) => (
                  <TableRow key={`${row.order_id ?? "sem-pedido"}-${row.product_id ?? index}`}>
                    <TableCell className="font-mono text-xs">{orDash(row.product_name)}</TableCell>
                    <TableCell className="tabular-nums">{formatAmount(row.amount_cents, row.currency)}</TableCell>
                    <TableCell>{orDash(row.event)}</TableCell>
                    <TableCell className="font-mono text-xs">{orDash(row.order_id)}</TableCell>
                    <TableCell className="tabular-nums">{formatTimestamp(row.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Bloco>

          <Bloco titulo="Produtos" total={produtos.length}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Oferta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((row) => {
                  const estado = descreverEstadoProduto(row.state);
                  return (
                    <TableRow key={`${row.offer_slug}-${row.product_key}`}>
                      <TableCell>{orDash(row.title)}</TableCell>
                      <TableCell className="font-mono text-xs">{orDash(row.product_key)}</TableCell>
                      <TableCell className="font-mono text-xs">{orDash(row.offer_slug)}</TableCell>
                      <TableCell>
                        <StatusBadge variant={estado.variante}>{estado.rotulo}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Bloco>
        </>
      )}
    </div>
  );
}
