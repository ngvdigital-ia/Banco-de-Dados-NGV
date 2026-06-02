"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface SpendRevenueData {
  date: string;
  spend: number;
  revenue: number;
}

export function SpendRevenueChart({ data }: { data: SpendRevenueData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Legend
          verticalAlign="top"
          formatter={(value) => (value === "spend" ? "Gasto" : "Receita")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value, name) => [
            `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            name === "spend" ? "Gasto" : "Receita",
          ]}
          labelFormatter={(label) => `Data: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="spend"
          stroke="var(--chart-4)"
          fillOpacity={1}
          fill="url(#colorSpend)"
          strokeWidth={2}
          name="spend"
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-1)"
          fillOpacity={1}
          fill="url(#colorRevenue)"
          strokeWidth={2}
          name="revenue"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
