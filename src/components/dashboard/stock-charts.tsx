"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTHB } from "@/lib/format";
import type { StockDashboardData } from "@/lib/types";

const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

function StockChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { count?: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{entry.name}</p>
      <p className="text-muted-foreground">{formatTHB(entry.value)}</p>
      {entry.payload.count !== undefined && (
        <p className="text-xs text-muted-foreground">{entry.payload.count} รายการ</p>
      )}
    </div>
  );
}

export function StockByCategoryChart({ data }: { data: StockDashboardData["categoryBreakdown"] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>มูลค่าสต๊อกแยกตามหมวดหมู่</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="category"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<StockChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={(value, entry) => {
                const v = (entry?.payload as unknown as { value: number } | undefined)?.value ?? 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return (
                  <span className="text-sm text-foreground">
                    {value} ({pct}%)
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
