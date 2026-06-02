"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface VendasTimelineData {
  date: string;
  receita: number;
  vendas: number;
}

export function VendasTimelineChart({
  data,
  currency,
}: {
  data: VendasTimelineData[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorVendasReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value, name) =>
            name === "receita"
              ? [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value)),
                  "Receita aprovada",
                ]
              : [value, "Vendas"]
          }
          labelFormatter={(label) => `Data: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="receita"
          stroke="var(--chart-1)"
          fillOpacity={1}
          fill="url(#colorVendasReceita)"
          strokeWidth={2}
          name="receita"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
