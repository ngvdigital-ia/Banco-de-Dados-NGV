"use server";

import { db } from "@/db";
import { metricsSnapshots } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

/**
 * Analytics de Vendas (entityType = "sale" em metrics_snapshots).
 *
 * Cada venda é gravada pelo webhook /api/webhooks/sales (PerfectPay/Hotmart/genérico).
 * `revenue` (numeric) = valor da venda; `extra_data` traz status, produto, moeda, UTMs.
 * SEM PII (o webhook e a limpeza histórica removeram email/nome/telefone/rawPayload).
 *
 * Regras de negócio:
 *  - Receita só conta status = 'approved'.
 *  - Receita líquida = aprovada − reembolsos (refunded) − chargebacks (charged_back).
 *  - 'precheckout' é RUÍDO (checkout abandonado, valor inflado) → nunca entra em receita.
 */

const APPROVED = "approved";

export interface VendasKpis {
  moeda: string;
  receitaAprovada: number;
  reembolsos: number;
  chargebacks: number;
  receitaLiquida: number;
  vendasAprovadas: number;
  ticketMedio: number;
  taxaReembolso: number; // % sobre a receita aprovada
  reembolsosCount: number;
}

export interface VendaTimelinePoint {
  date: string;
  receita: number;
  vendas: number;
}

export interface VendaPorProduto {
  produto: string;
  vendas: number;
  receita: number;
  ticketMedio: number;
}

export interface VendaPorStatus {
  status: string;
  vendas: number;
  receita: number;
  contabilizada: boolean;
}

export interface VendaPorCampanha {
  campanha: string;
  vendas: number;
  receita: number;
  ticketMedio: number;
}

export interface VendasAnalytics {
  kpis: VendasKpis;
  timeline: VendaTimelinePoint[];
  porProduto: VendaPorProduto[];
  porStatus: VendaPorStatus[];
  porCampanha: VendaPorCampanha[];
  totalRegistros: number;
  precheckoutIgnorados: number;
}

// Status cuja receita é contabilizada (entra no breakdown como "real")
const CONTABILIZADOS = new Set(["approved", "refunded", "charged_back"]);

function baseConditions(dateFrom?: string, dateTo?: string) {
  const conditions = [eq(metricsSnapshots.entityType, "sale")];
  if (dateFrom) conditions.push(gte(metricsSnapshots.date, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(metricsSnapshots.date, new Date(dateTo)));
  return conditions;
}

export async function getVendasAnalytics(
  dateFrom?: string,
  dateTo?: string,
): Promise<VendasAnalytics> {
  const where = and(...baseConditions(dateFrom, dateTo));

  // jsonb helpers
  const status = sql`${metricsSnapshots.extraData}->>'status'`;
  const approvedRevenue = sql`sum(${metricsSnapshots.revenue}) filter (where ${metricsSnapshots.extraData}->>'status' = ${APPROVED})`;
  const approvedCount = sql`count(*) filter (where ${metricsSnapshots.extraData}->>'status' = ${APPROVED})`;

  const [kpiRows, timelineRows, produtoRows, statusRows, campanhaRows] = await Promise.all([
    // 1) KPIs agregados + moeda dominante
    db
      .select({
        moeda: sql<string>`mode() within group (order by ${metricsSnapshots.extraData}->>'currency')`,
        receitaAprovada: sql<string>`coalesce(${approvedRevenue}, 0)`,
        reembolsos: sql<string>`coalesce(sum(${metricsSnapshots.revenue}) filter (where ${status} = 'refunded'), 0)`,
        chargebacks: sql<string>`coalesce(sum(${metricsSnapshots.revenue}) filter (where ${status} = 'charged_back'), 0)`,
        vendasAprovadas: sql<string>`${approvedCount}`,
        reembolsosCount: sql<string>`count(*) filter (where ${status} in ('refunded','charged_back'))`,
        precheckout: sql<string>`count(*) filter (where ${status} = 'precheckout')`,
        total: sql<string>`count(*)`,
      })
      .from(metricsSnapshots)
      .where(where),

    // 2) Timeline diária (receita aprovada por dia)
    db
      .select({
        date: sql<string>`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`,
        receita: sql<string>`coalesce(${approvedRevenue}, 0)`,
        vendas: sql<string>`${approvedCount}`,
      })
      .from(metricsSnapshots)
      .where(where)
      .groupBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${metricsSnapshots.date}, 'YYYY-MM-DD')`),

    // 3) Por produto (só aprovadas)
    db
      .select({
        produto: sql<string>`coalesce(nullif(${metricsSnapshots.extraData}->>'productName', ''), '(sem produto)')`,
        vendas: sql<string>`${approvedCount}`,
        receita: sql<string>`coalesce(${approvedRevenue}, 0)`,
      })
      .from(metricsSnapshots)
      .where(where)
      .groupBy(sql`coalesce(nullif(${metricsSnapshots.extraData}->>'productName', ''), '(sem produto)')`)
      .orderBy(sql`coalesce(${approvedRevenue}, 0) desc`),

    // 4) Por status (todos — transparência do funil)
    db
      .select({
        status: sql<string>`coalesce(nullif(${status}, ''), '(sem status)')`,
        vendas: sql<string>`count(*)`,
        receita: sql<string>`coalesce(sum(${metricsSnapshots.revenue}), 0)`,
      })
      .from(metricsSnapshots)
      .where(where)
      .groupBy(sql`coalesce(nullif(${status}, ''), '(sem status)')`)
      .orderBy(sql`count(*) desc`),

    // 5) Atribuição por campanha (só aprovadas).
    // Agrupa SÓ por utmCampaign — o utmSource do Facebook é um ID único por clique
    // (ex: "FBjLj6a..."), que fragmentaria o ranking em 1 venda por linha.
    db
      .select({
        campanha: sql<string>`coalesce(nullif(${metricsSnapshots.extraData}->>'utmCampaign', ''), '(sem campanha)')`,
        vendas: sql<string>`${approvedCount}`,
        receita: sql<string>`coalesce(${approvedRevenue}, 0)`,
      })
      .from(metricsSnapshots)
      .where(where)
      .groupBy(sql`coalesce(nullif(${metricsSnapshots.extraData}->>'utmCampaign', ''), '(sem campanha)')`)
      .orderBy(sql`coalesce(${approvedRevenue}, 0) desc`),
  ]);

  const k = kpiRows[0];
  const receitaAprovada = Number(k?.receitaAprovada ?? 0);
  const reembolsos = Number(k?.reembolsos ?? 0);
  const chargebacks = Number(k?.chargebacks ?? 0);
  const vendasAprovadas = Number(k?.vendasAprovadas ?? 0);
  const receitaLiquida = receitaAprovada - reembolsos - chargebacks;

  const kpis: VendasKpis = {
    moeda: k?.moeda ?? "USD",
    receitaAprovada,
    reembolsos,
    chargebacks,
    receitaLiquida,
    vendasAprovadas,
    ticketMedio: vendasAprovadas > 0 ? receitaAprovada / vendasAprovadas : 0,
    taxaReembolso: receitaAprovada > 0 ? ((reembolsos + chargebacks) / receitaAprovada) * 100 : 0,
    reembolsosCount: Number(k?.reembolsosCount ?? 0),
  };

  const timeline = timelineRows.map((r) => ({
    date: r.date,
    receita: Number(r.receita),
    vendas: Number(r.vendas),
  }));

  const porProduto = produtoRows
    .map((r) => {
      const vendas = Number(r.vendas);
      const receita = Number(r.receita);
      return { produto: r.produto, vendas, receita, ticketMedio: vendas > 0 ? receita / vendas : 0 };
    })
    .filter((p) => p.vendas > 0);

  const porStatus = statusRows.map((r) => ({
    status: r.status,
    vendas: Number(r.vendas),
    receita: Number(r.receita),
    contabilizada: CONTABILIZADOS.has(r.status),
  }));

  const porCampanha = campanhaRows
    .map((r) => {
      const vendas = Number(r.vendas);
      const receita = Number(r.receita);
      return { campanha: r.campanha, vendas, receita, ticketMedio: vendas > 0 ? receita / vendas : 0 };
    })
    .filter((c) => c.vendas > 0)
    .slice(0, 25);

  return {
    kpis,
    timeline,
    porProduto,
    porStatus,
    porCampanha,
    totalRegistros: Number(k?.total ?? 0),
    precheckoutIgnorados: Number(k?.precheckout ?? 0),
  };
}
