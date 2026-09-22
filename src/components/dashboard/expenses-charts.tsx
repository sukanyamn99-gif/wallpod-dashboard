"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTHB } from "@/lib/format";

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
  payload?: { name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label ?? entry.name}</p>
      <p className="text-muted-foreground">{formatTHB(entry.value)}</p>
    </div>
  );
}

export function MonthlyExpenseTrendChart({ data }: { data: { monthLabel: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ค่าใช้จ่ายรายเดือน ({data.length} เดือนล่าสุด)</CardTitle>
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
            <Bar dataKey="value" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ExpenseCategoryChart({ data }: { data: { category: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>สัดส่วนหมวดหมู่ค่าใช้จ่าย</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
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
              </PieChart>
            </ResponsiveContainer>
            {/* Plain HTML legend instead of recharts' <Legend>: that one is
                given a fixed pixel height, and with this many categories it
                wraps to more rows than fit, clipping the rest. A normal
                flex-wrap list simply grows to fit however many there are. */}
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
              {data.map((entry, i) => {
                // Rounding to a whole percent made any real-but-small
                // category (petty cash items like ค่าไปรษณีย์/ค่าโปรแกรม are
                // typically tiny) display as a flat "(0%)", indistinguishable
                // from having no expense at all. One decimal place keeps a
                // genuinely small share visible.
                const pct = total > 0 ? (entry.value / total) * 100 : 0;
                return (
                  <li key={entry.category} className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}
                    />
                    <span>
                      {entry.category} ({pct.toFixed(1)}%)
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
