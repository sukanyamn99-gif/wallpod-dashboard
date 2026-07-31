"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatTHB } from "@/lib/format";
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

function MonthlyTrendTooltip({
  active,
  payload,
  label,
  unitLabel,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unitLabel: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {formatNumber(payload[0].value)} {unitLabel}
      </p>
    </div>
  );
}

// A single measure per chart, on its own axis — the reference this was built from
// plotted requisition count and total quantity as two lines sharing one axis,
// which collapses the (much smaller) count series to a flat line near zero.
// Two honest single-series charts instead of one misleading dual-axis chart.
export function MonthlyTrendChart({
  title,
  data,
  unitLabel,
}: {
  title: string;
  data: { monthLabel: string; value: number }[];
  unitLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
              width={60}
            />
            <Tooltip content={<MonthlyTrendTooltip unitLabel={unitLabel} />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TopRequisitionedProductsChart({
  data,
}: {
  data: { productName: string; quantity: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>สินค้าที่เบิกบ่อยที่สุด ({data.length} อันดับ)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="productName"
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground">{formatNumber(payload[0].value as number)} หน่วย</p>
                  </div>
                );
              }}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar dataKey="quantity" fill="var(--chart-5)" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const MOVEMENT_COLORS: Record<"in" | "out", string> = {
  in: "var(--chart-2)",
  out: "var(--status-critical)",
};
const MOVEMENT_LABELS: Record<"in" | "out", string> = {
  in: "รับเข้า (IN)",
  out: "เบิกออก (OUT)",
};

export function MovementSummaryChart({
  data,
}: {
  data: { type: "in" | "out"; count: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d) => ({ ...d, label: MOVEMENT_LABELS[d.type] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>สรุปการเคลื่อนไหวสต็อก</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.type} fill={MOVEMENT_COLORS[entry.type]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as { label: string; count: number };
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium">{entry.label}</p>
                    <p className="text-muted-foreground">{formatNumber(entry.count)} รายการ</p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={(value, entry) => {
                const v = (entry?.payload as unknown as { count: number } | undefined)?.count ?? 0;
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
