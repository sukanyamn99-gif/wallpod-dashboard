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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function PipelineByStageChart({ data }: { data: SalesDashboardData["pipelineByStage"] }) {
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
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

export function CustomerTypeChart({ data }: { data: SalesDashboardData["customerTypeBreakdown"] }) {
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
            >
              {data.map((entry, i) => (
                <Cell key={entry.type} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ProductCategoryChart({ data }: { data: SalesDashboardData["categoryBreakdown"] }) {
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
            >
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SalesRepPerformanceChart({
  data,
}: {
  data: SalesDashboardData["salesRepPerformance"];
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
            <Bar dataKey="totalValue" radius={[0, 4, 4, 0]} maxBarSize={28}>
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

export function RepMonthlyPerformanceTable({
  data,
}: {
  data: SalesDashboardData["repMonthlyPerformance"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ผลงานรายเซลล์แยกตามเดือน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">เซลล์</TableHead>
                {data.months.map((m) => (
                  <TableHead key={m} className="text-right whitespace-nowrap">
                    {m}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">รวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.salesRepId}>
                  <TableCell className="whitespace-nowrap font-medium">{row.salesRepName}</TableCell>
                  {row.values.map((v, i) => (
                    <TableCell key={i} className="text-right whitespace-nowrap">
                      {v ? formatTHB(v) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap font-medium">
                    {formatTHB(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function MonthlySalesChart({ data }: { data: SalesDashboardData["monthlySales"] }) {
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
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
