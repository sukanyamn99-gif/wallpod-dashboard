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
import { formatTHB } from "@/lib/format";
import type { SalesDashboardData } from "@/lib/types";

const STAGE_COLOR_BY_PERCENT: Record<number, string> = {
  10: "var(--chart-seq-1)",
  30: "var(--chart-seq-2)",
  50: "var(--chart-seq-3)",
  100: "var(--chart-seq-4)",
  0: "var(--status-critical)",
};

const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { count?: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label ?? entry.name}</p>
      <p className="text-muted-foreground">{formatTHB(entry.value)}</p>
      {entry.payload.count !== undefined && (
        <p className="text-xs text-muted-foreground">{entry.payload.count} งาน</p>
      )}
    </div>
  );
}

export function PipelineByStageChart({
  data,
  onBarClick,
}: {
  data: SalesDashboardData["pipelineByStage"];
  onBarClick?: (stage: SalesDashboardData["pipelineByStage"][number]["stage"]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline ตามขั้นตอน</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTHB(v)}
              width={90}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={64}
              onClick={
                onBarClick
                  ? (entry) => onBarClick((entry.payload as SalesDashboardData["pipelineByStage"][number]).stage)
                  : undefined
              }
              cursor={onBarClick ? "pointer" : undefined}
            >
              {data.map((entry) => (
                <Cell key={entry.stage} fill={STAGE_COLOR_BY_PERCENT[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CustomerTypeChart({
  data,
  onSliceClick,
}: {
  data: SalesDashboardData["customerTypeBreakdown"];
  onSliceClick?: (type: SalesDashboardData["customerTypeBreakdown"][number]["type"]) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>สัดส่วนกลุ่มลูกค้า</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="type"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              onClick={
                onSliceClick
                  ? (entry) => onSliceClick((entry.payload as SalesDashboardData["customerTypeBreakdown"][number]).type)
                  : undefined
              }
              cursor={onSliceClick ? "pointer" : undefined}
            >
              {data.map((entry, i) => (
                <Cell key={entry.type} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
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

export function ProductCategoryChart({
  data,
  onSliceClick,
}: {
  data: SalesDashboardData["categoryBreakdown"];
  onSliceClick?: (category: SalesDashboardData["categoryBreakdown"][number]["category"]) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>สัดส่วนประเภทงาน</CardTitle>
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
              onClick={
                onSliceClick
                  ? (entry) => onSliceClick((entry.payload as SalesDashboardData["categoryBreakdown"][number]).category)
                  : undefined
              }
              cursor={onSliceClick ? "pointer" : undefined}
            >
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
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

export function SalesRepPerformanceChart({
  data,
  onBarClick,
}: {
  data: SalesDashboardData["salesRepPerformance"];
  onBarClick?: (salesRepId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ผลงานรายเซลล์</CardTitle>
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
              tickFormatter={(v) => formatTHB(v)}
            />
            <YAxis
              type="category"
              dataKey="salesRepName"
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as SalesDashboardData["salesRepPerformance"][number];
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground">มูลค่ารวม: {formatTHB(row.totalValue)}</p>
                    <p className="text-muted-foreground">ปิดแล้ว: {formatTHB(row.closedValue)}</p>
                    <p className="text-xs text-muted-foreground">{row.projectCount} งาน</p>
                  </div>
                );
              }}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar
              dataKey="totalValue"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              onClick={
                onBarClick
                  ? (entry) => onBarClick((entry.payload as SalesDashboardData["salesRepPerformance"][number]).salesRepId)
                  : undefined
              }
              cursor={onBarClick ? "pointer" : undefined}
            >
              {data.map((entry, i) => (
                <Cell key={entry.salesRepId} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RepMonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (nonZero.length === 0) return null;

  return (
    <div className="max-w-xs rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <div className="space-y-0.5">
        {nonZero.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span>{formatTHB(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RepMonthlyPerformanceChart({
  data,
  onBarClick,
}: {
  data: SalesDashboardData["repMonthlyPerformance"];
  onBarClick?: (salesRepId: string, monthIndex: number) => void;
}) {
  const chartData = data.months.map((month, i) => {
    const point: Record<string, string | number> = { month };
    for (const row of data.rows) point[row.salesRepId] = row.values[i];
    return point;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ผลงานรายเซลล์แยกตามเดือน</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTHB(v)}
              width={90}
            />
            <Tooltip content={<RepMonthlyTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Legend
              verticalAlign="bottom"
              height={56}
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
            />
            {data.rows.map((row, i) => (
              <Bar
                key={row.salesRepId}
                dataKey={row.salesRepId}
                name={row.salesRepName}
                fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                radius={[3, 3, 0, 0]}
                maxBarSize={16}
                onClick={onBarClick ? (_entry, index) => onBarClick(row.salesRepId, index) : undefined}
                cursor={onBarClick ? "pointer" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MonthlySalesChart({
  data,
  onBarClick,
}: {
  data: SalesDashboardData["monthlySales"];
  onBarClick?: (monthIndex: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ยอดขายรายเดือน ({data.length} เดือนล่าสุด)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
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
              tickFormatter={(v) => formatTHB(v)}
              width={90}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              onClick={onBarClick ? (_entry, index) => onBarClick(index) : undefined}
              cursor={onBarClick ? "pointer" : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
