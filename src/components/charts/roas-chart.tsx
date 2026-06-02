"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export interface RoasData {
  date: string;
  roas: number;
}

export function RoasChart({ data }: { data: RoasData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) => `${v.toFixed(1)}x`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value) => [`${Number(value).toFixed(2)}x`, "ROAS"]}
          labelFormatter={(label) => `Data: ${label}`}
        />
        <Legend
          verticalAlign="top"
          formatter={() => "ROAS"}
          wrapperStyle={{ fontSize: 12 }}
        />
        <ReferenceLine
          y={1}
          stroke="var(--chart-3)"
          strokeDasharray="3 3"
          label={{ value: "Break-even", position: "right", fontSize: 11 }}
        />
        <Bar
          dataKey="roas"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
