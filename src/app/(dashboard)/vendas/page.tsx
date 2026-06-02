import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { getDateRange } from "@/lib/date-utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LazyVendasTimelineChart } from "@/components/charts/vendas-charts";
import { ShoppingCart } from "lucide-react";
import { getVendasAnalytics } from "./actions";

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

const statusLabels: Record<string, string> = {
  approved: "Aprovada",
  refunded: "Reembolsada",
  charged_back: "Chargeback",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  precheckout: "Pré-checkout",
  pending: "Pendente",
  in_process: "Em processamento",
  in_mediation: "Em mediação",
  expired: "Expirada",
};

const metodoLabels: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  amex: "Amex",
  elo: "Elo",
  hipercard: "Hipercard",
  melicard: "Melicard",
  boleto: "Boleto",
  pix: "Pix",
  outros: "Outros",
};

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "success" | "danger" | "warning";
}) {
  const accentClass =
    accent === "success"
      ? "border-l-2 border-l-success"
      : accent === "danger"
      ? "border-l-2 border-l-danger"
      : accent === "warning"
      ? "border-l-2 border-l-warning"
      : "";
  return (
    <Card className={`border-border/60 bg-card/80 ${accentClass}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="tabular-nums text-2xl font-bold">{value}</div>
        {sub && <p className="tabular-nums mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const period = typeof params.period === "string" ? params.period : "all";
  const { from, to } = getDateRange(period);
  const dateFrom = period === "all" ? undefined : from.toISOString();
  const dateTo = period === "all" ? undefined : to.toISOString();

  const { kpis, timeline, porProduto, porStatus, porCampanha, porMetodo, totalRegistros, precheckoutIgnorados } =
    await getVendasAnalytics(dateFrom, dateTo);
  const moeda = kpis.moeda;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vendas"
        description="Receita real das vendas recebidas via webhook (PerfectPay/Hotmart). Considera reembolsos e exclui pré-checkouts (checkout abandonado)."
      />

      <Suspense fallback={<div className="h-8" />}>
        <DateRangeFilter />
      </Suspense>

      {totalRegistros === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda no período"
          description="As vendas chegam automaticamente pelo webhook das plataformas de pagamento. Ajuste o período ou aguarde novas vendas."
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Receita líquida"
              value={fmt(kpis.receitaLiquida, moeda)}
              sub={`Bruta ${fmt(kpis.receitaAprovada, moeda)} − devoluções ${fmt(kpis.reembolsos + kpis.chargebacks, moeda)}`}
              accent="success"
            />
            <KpiCard
              label="Vendas aprovadas"
              value={String(kpis.vendasAprovadas)}
              sub={`${totalRegistros} eventos no total`}
            />
            <KpiCard
              label="Ticket médio"
              value={fmt(kpis.ticketMedio, moeda)}
              sub="Por venda aprovada"
            />
            <KpiCard
              label="Taxa de reembolso"
              value={`${kpis.taxaReembolso.toFixed(1)}%`}
              sub={`${kpis.reembolsosCount} reembolso(s)`}
              accent={kpis.taxaReembolso >= 15 ? "danger" : kpis.taxaReembolso >= 8 ? "warning" : undefined}
            />
            <KpiCard
              label="Taxa de chargeback"
              value={`${kpis.taxaChargeback.toFixed(1)}%`}
              sub={`${kpis.chargebacksCount} chargeback(s)`}
              accent={kpis.taxaChargeback >= 2 ? "danger" : kpis.taxaChargeback >= 1 ? "warning" : undefined}
            />
          </div>

          {/* Timeline */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Receita aprovada por dia</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {timeline.length > 0 ? (
                <LazyVendasTimelineChart data={timeline} currency={moeda} />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Sem receita aprovada no período.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Por produto */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Receita por oferta</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {porProduto.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma venda aprovada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oferta</TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendas</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket</TableHead>
                        <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porProduto.map((p, i) => (
                        <TableRow key={p.produto} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                          <TableCell className="pl-4 max-w-[220px] truncate font-medium text-sm" title={p.produto}>
                            {p.produto}
                          </TableCell>
                          <TableCell className="tabular-nums text-center text-sm">{p.vendas}</TableCell>
                          <TableCell className="tabular-nums text-right text-sm text-muted-foreground">{fmt(p.ticketMedio, moeda)}</TableCell>
                          <TableCell className="tabular-nums pr-4 text-right text-sm font-semibold text-success">{fmt(p.receita, moeda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Breakdown por status */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Funil por status</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eventos</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porStatus.map((s, i) => (
                      <TableRow key={s.status} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                        <TableCell className="pl-4 text-sm">
                          <span className={s.contabilizada ? "" : "text-muted-foreground/60"}>
                            {statusLabels[s.status] ?? s.status}
                          </span>
                          {!s.contabilizada && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground/50">
                              não contabilizado
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-center text-sm">{s.vendas}</TableCell>
                        <TableCell className="tabular-nums pr-4 text-right text-sm">
                          {s.contabilizada ? (
                            <span className={s.status === "approved" ? "text-success" : "text-danger"}>
                              {fmt(s.receita, moeda)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Aprovação por método de pagamento (geral) */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Aprovação por método de pagamento</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {porMetodo.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Sem transações processadas no período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tentativas</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aprovadas</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aprovação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porMetodo.map((m, i) => (
                      <TableRow key={m.metodo} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                        <TableCell className="pl-4 text-sm font-medium">{metodoLabels[m.metodo] ?? m.metodo}</TableCell>
                        <TableCell className="tabular-nums text-center text-sm text-muted-foreground">{m.tentativas}</TableCell>
                        <TableCell className="tabular-nums text-center text-sm">{m.aprovadas}</TableCell>
                        <TableCell className="tabular-nums pr-4 text-right text-sm font-semibold">
                          <span className={m.taxaAprovacao >= 80 ? "text-success" : m.taxaAprovacao >= 60 ? "text-warning" : "text-danger"}>
                            {m.taxaAprovacao.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Atribuição por campanha */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">Atribuição por campanha</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {porCampanha.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma venda aprovada com UTM de campanha no período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 w-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campanha</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendas</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket</TableHead>
                      <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porCampanha.map((c, i) => (
                      <TableRow key={`${c.campanha}-${i}`} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                        <TableCell className="pl-4 tabular-nums text-sm font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="max-w-[420px] truncate font-mono text-xs" title={c.campanha}>{c.campanha}</TableCell>
                        <TableCell className="tabular-nums text-center text-sm">{c.vendas}</TableCell>
                        <TableCell className="tabular-nums text-right text-sm text-muted-foreground">{fmt(c.ticketMedio, moeda)}</TableCell>
                        <TableCell className="tabular-nums pr-4 text-right text-sm font-semibold text-success">{fmt(c.receita, moeda)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {precheckoutIgnorados > 0 && (
            <p className="text-xs text-muted-foreground">
              {precheckoutIgnorados} pré-checkout(s) ignorado(s) no período — checkouts iniciados e não
              concluídos, com valores não realizados; não entram em nenhuma métrica de receita.
            </p>
          )}
        </>
      )}
    </div>
  );
}
