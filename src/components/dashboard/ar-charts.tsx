"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { chartGradient } from "@/lib/chart-gradient";
import { formatTHB } from "@/lib/format";
import type { ArDashboardData, ReceivableRow } from "@/lib/data/ar";

const AGING_COLORS = ["var(--chart-seq-1)", "var(--chart-seq-2)", "var(--chart-seq-3)", "var(--status-critical)"];

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

export function AgingBucketChart({ data }: { data: ArDashboardData["agingBuckets"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ลูกหนี้แยกตามอายุหนี้</CardTitle>
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
            <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={64}>
              {data.map((entry, i) => (
                <Cell key={entry.label} fill={chartGradient(AGING_COLORS[i % AGING_COLORS.length], "v")} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ByStatusChart({ data }: { data: ArDashboardData["byStatus"] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ลูกหนี้แยกตามสถานะการชำระ</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="status"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell key={entry.status} fill={chartGradient(CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length], "d")} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={48}
              formatter={(value, entry) => {
                const v = (entry?.payload as unknown as { amount: number } | undefined)?.amount ?? 0;
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

// Thai combining marks (upper/lower vowels, tone marks) take no horizontal space.
const THAI_COMBINING = /[ัิ-ฺ็-๎]/g;
const visualLength = (s: string) => s.replace(THAI_COMBINING, "").length;

// Wrap a name on spaces into at most `maxLines` lines; the remainder is cut with an ellipsis.
function wrapLabel(text: string, maxUnits: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  const words = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (visualLength(candidate) <= maxUnits || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }
  if (!truncated && current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }

  const clip = (s: string) => {
    let out = s;
    while (visualLength(out) > maxUnits - 1 && out.length > 1) out = out.slice(0, -1);
    return `${out}…`;
  };
  const last = lines.length - 1;
  if (truncated && last >= 0) lines[last] = clip(lines[last]);
  else if (last >= 0 && visualLength(lines[last]) > maxUnits) lines[last] = clip(lines[last]);
  return lines;
}

const DEBTOR_LABEL_WIDTH = 210;
const DEBTOR_ROW_HEIGHT = 44;

function DebtorTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const lines = wrapLabel(String(payload?.value ?? ""), 30, 2);
  const lineHeight = 14;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  return (
    <text x={x} y={y} textAnchor="end" fill="var(--foreground)" fontSize={12}>
      {lines.map((line, i) => (
        <tspan key={i} x={x - 4} dy={i === 0 ? startDy + 4 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function TopDebtorsChart({
  data,
  list,
}: {
  data: ArDashboardData["byCustomer"];
  list: ReceivableRow[];
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const rowsForSelected = selectedCustomer ? list.filter((r) => r.customerName === selectedCustomer) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>ลูกหนี้รายลูกค้า (Top 8)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * DEBTOR_ROW_HEIGHT + 40)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
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
              dataKey="customerName"
              tick={<DebtorTick />}
              interval={0}
              axisLine={false}
              tickLine={false}
              width={DEBTOR_LABEL_WIDTH}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="amount"
              radius={[0, 8, 8, 0]}
              maxBarSize={28}
              cursor="pointer"
              onClick={(entry) =>
                setSelectedCustomer((entry.payload as ArDashboardData["byCustomer"][number]).customerName)
              }
            >
              {data.map((entry, i) => (
                <Cell key={entry.customerName} fill={chartGradient(CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length], "h")} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <Dialog open={selectedCustomer !== null} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer} ({rowsForSelected.length} งาน)
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">JOB NO.</TableHead>
                    <TableHead className="whitespace-nowrap">วันที่</TableHead>
                    <TableHead className="whitespace-nowrap">ชื่องาน</TableHead>
                    <TableHead className="text-right whitespace-nowrap">ค้างชำระ</TableHead>
                    <TableHead className="text-right whitespace-nowrap">อายุหนี้ (วัน)</TableHead>
                    <TableHead className="whitespace-nowrap">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsForSelected.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.jobNo ? (
                          <Link
                            href={`/dashboard/project-sales/edit/${encodeURIComponent(r.jobNo)}`}
                            className="underline underline-offset-2"
                          >
                            {r.jobNo}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.projectDate}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.projectName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(r.outstanding ?? 0)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{r.ageDays}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm">{r.status ?? "—"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
