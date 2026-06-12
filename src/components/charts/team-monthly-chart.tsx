"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface TeamMonthlySeriesItem {
  member: string;
  data: { month: string; tasks: number }[];
}

export interface TeamMonthlyChartProps {
  months: string[];
  series: TeamMonthlySeriesItem[];
}

// Variáveis CSS das 5 cores do design system (cicladas quando há mais de 5 membros)
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * Para o Recharts LineChart, cada ponto do eixo X precisa ser um objeto com
 * todas as chaves de membro. Transforma o formato "série por membro" em
 * "array de pontos por mês".
 */
function buildChartData(
  months: string[],
  series: TeamMonthlySeriesItem[],
): Record<string, number | string>[] {
  return months.map((month) => {
    const point: Record<string, number | string> = { month };
    for (const s of series) {
      const entry = s.data.find((d) => d.month === month);
      point[s.member] = entry?.tasks ?? 0;
    }
    return point;
  });
}

export function TeamMonthlyChart({ months, series }: TeamMonthlyChartProps) {
  const chartData = buildChartData(months, series);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value) => {
            const n = Number(value ?? 0);
            return [`${n} tarefa${n !== 1 ? "s" : ""}`, ""];
          }}
          labelFormatter={(label) => `Mês: ${label}`}
        />
        {series.map((s, idx) => (
          <Line
            key={s.member}
            type="monotone"
            dataKey={s.member}
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
