"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Layers, Users } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GpPanel } from "@/components/dashboard/gp-panel";
import { chartGradient } from "@/lib/chart-gradient";
import { cn } from "@/lib/utils";
import { formatNumber, formatTHB } from "@/lib/format";
import type { GpDashboardData } from "@/lib/data/gp";
import type { FullProjectRow } from "@/lib/data/project-sales";

// Bar gradients (left -> right) and the donut's flat colours, in the order the
// groups are ranked.
const BAR_GRADIENTS: [string, string][] = [
  ["#1d6fe0", "#38bdf8"],
  ["#10b981", "#6ee7b7"],
  ["#f5b73c", "#fde68a"],
  ["#22c55e", "#86efac"],
  ["#8b5cf6", "#c4b5fd"],
  ["#ec4899", "#f9a8d4"],
  ["#f43f5e", "#fda4af"],
  ["#0ea5e9", "#7dd3fc"],
  ["#14b8a6", "#5eead4"],
  ["#f97316", "#fdba74"],
];
const DONUT_COLORS = ["#3b82f6", "#10b981", "#f5b73c", "#a78bfa", "#f97316", "#6366f1", "#14b8a6", "#ec4899"];

const AXIS_TICK = { fill: "#94a3b8", fontSize: 12 };
const GRID_STROKE = "rgb(148 163 184 / 0.14)";

function GlassTooltip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-sky-400/30 bg-slate-950/95 px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-white">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-slate-300">
          {line}
        </p>
      ))}
    </div>
  );
}

function BarGradientDefs({ prefix, count }: { prefix: string; count: number }) {
  return (
    <defs>
      {Array.from({ length: count }, (_, i) => {
        const [from, to] = BAR_GRADIENTS[i % BAR_GRADIENTS.length];
        return (
          <linearGradient key={i} id={`${prefix}-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        );
      })}
    </defs>
  );
}

function marginPercent(row: FullProjectRow): string {
  return row.preVat > 0 ? (((row.profit ?? 0) / row.preVat) * 100).toFixed(1) : "0.0";
}

export function GpByProductChart({ data }: { data: GpDashboardData["byProductCategory"] }) {
  const height = Math.max(260, data.length * 34 + 30);

  return (
    <GpPanel title="กำไรขั้นต้นรายกลุ่มสินค้า" icon={BarChart3}>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 96, top: 4, bottom: 4 }}>
            <BarGradientDefs prefix="gp-prod" count={data.length} />
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: "#e2e8f0", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as GpDashboardData["byProductCategory"][number];
                return (
                  <GlassTooltip
                    title={row.category}
                    lines={[`กำไร: ${formatTHB(row.profit)}`, `มูลค่าขาย: ${formatTHB(row.preVat)}`]}
                  />
                );
              }}
            />
            <Bar dataKey="profit" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {data.map((entry, i) => (
                <Cell key={entry.category} fill={`url(#gp-prod-${i})`} />
              ))}
              <LabelList dataKey="profit" position="right" formatter={(v) => formatTHB(Number(v))} fill="#cbd5e1" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2 text-xs text-slate-400">
        ต้นทุนเก็บเป็นรายงาน — กำไรของแต่ละงานจึงถูกแบ่งให้แต่ละกลุ่มสินค้าตามสัดส่วนยอดสินค้าในงานนั้น (ค่าประมาณ)
      </p>
    </GpPanel>
  );
}

export function GpByCustomerTypeChart({ data }: { data: GpDashboardData["byCustomerType"] }) {
  const total = data.reduce((sum, d) => sum + d.profit, 0);
  // A negative group can't be drawn as a slice, so only positive ones are in the ring.
  const positive = data.filter((d) => d.profit > 0);
  const positiveTotal = positive.reduce((sum, d) => sum + d.profit, 0);
  const colorOf = (type: string) => DONUT_COLORS[Math.max(0, data.findIndex((d) => d.type === type)) % DONUT_COLORS.length];

  return (
    <GpPanel title="กำไรขั้นต้นแยกตามลูกค้า" icon={Layers}>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
      ) : (
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <div className="relative h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={positive}
                  dataKey="profit"
                  nameKey="type"
                  innerRadius={72}
                  outerRadius={104}
                  paddingAngle={2}
                  stroke="rgb(8 14 32)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {positive.map((entry) => (
                    <Cell key={entry.type} fill={chartGradient(colorOf(entry.type), "d")} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as { type: string; profit: number };
                    return <GlassTooltip title={row.type} lines={[formatTHB(row.profit)]} />;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold tabular-nums text-white">{formatTHB(total)}</p>
              <p className="text-xs text-slate-400">กำไรขั้นต้นรวม</p>
            </div>
          </div>

          <ul className="w-full flex-1 divide-y divide-slate-700/50 rounded-xl border border-slate-700/50 bg-slate-950/30 px-3 py-1 text-sm">
            {data.map((d) => (
              <li key={d.type} className="flex items-center justify-between gap-3 py-1.5">
                <span className="flex items-center gap-2 text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(d.type) }} />
                  {d.type}
                  {d.profit > 0 && positiveTotal > 0 && (
                    <span className="text-slate-400">({Math.round((d.profit / positiveTotal) * 100)}%)</span>
                  )}
                </span>
                <span className="tabular-nums text-white">{formatTHB(d.profit)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GpPanel>
  );
}

export function MonthlyGpTrendChart({ data }: { data: GpDashboardData["monthlyTrend"] }) {
  const [mode, setMode] = useState<"value" | "margin">("value");
  const key = mode === "value" ? "profit" : "marginPercent";

  return (
    <GpPanel
      title={`แนวโน้มกำไรขั้นต้นรายเดือน (${data.length} เดือน)`}
      icon={CalendarDays}
      action={
        <div className="flex rounded-full border border-sky-400/30 bg-slate-950/50 p-0.5 text-sm">
          {(
            [
              ["value", "มูลค่า"],
              ["margin", "% GP"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "rounded-full px-4 py-1 transition-colors",
                mode === value ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 24, bottom: 4 }}>
          <defs>
            <linearGradient id="gp-month" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b9bff" />
              <stop offset="100%" stopColor="#1e4fb8" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="monthLabel" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={72}
            tickFormatter={(v) => (mode === "value" ? formatNumber(v) : `${v}%`)}
          />
          <Tooltip
            cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as GpDashboardData["monthlyTrend"][number];
              return (
                <GlassTooltip
                  title={row.monthLabel}
                  lines={[
                    `กำไรขั้นต้น: ${formatTHB(row.profit)}`,
                    `มูลค่าขาย: ${formatTHB(row.preVat)}`,
                    `% GP: ${row.marginPercent.toFixed(1)}%`,
                  ]}
                />
              );
            }}
          />
          <Bar dataKey={key} fill="url(#gp-month)" radius={[6, 6, 0, 0]} maxBarSize={56}>
            <LabelList
              dataKey={key}
              position="top"
              formatter={(v) => (mode === "value" ? formatNumber(Number(v)) : `${Number(v).toFixed(1)}%`)}
              fill="#e2e8f0"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </GpPanel>
  );
}

export function GpBySalesRepChart({
  data,
  list,
}: {
  data: GpDashboardData["bySalesRep"];
  list: FullProjectRow[];
}) {
  const [selectedRep, setSelectedRep] = useState<string | null>(null);
  const rowsForSelected = selectedRep ? list.filter((r) => r.salesRepName === selectedRep) : [];
  const height = Math.max(240, data.length * 40 + 30);

  return (
    <GpPanel title="กำไรขั้นต้นรายเซลล์" icon={Users}>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ไม่มีข้อมูล</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 96, top: 4, bottom: 4 }}>
            <BarGradientDefs prefix="gp-rep" count={data.length} />
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
            <YAxis
              type="category"
              dataKey="salesRepName"
              tick={{ fill: "#e2e8f0", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as GpDashboardData["bySalesRep"][number];
                return (
                  <GlassTooltip
                    title={row.salesRepName}
                    lines={[`กำไร: ${formatTHB(row.profit)}`, `มูลค่า: ${formatTHB(row.preVat)}`, `${row.jobCount} งาน`]}
                  />
                );
              }}
            />
            <Bar
              dataKey="profit"
              radius={[0, 6, 6, 0]}
              maxBarSize={22}
              cursor="pointer"
              onClick={(entry) => setSelectedRep((entry.payload as GpDashboardData["bySalesRep"][number]).salesRepName)}
            >
              {data.map((entry, i) => (
                <Cell key={entry.salesRepId} fill={`url(#gp-rep-${i})`} />
              ))}
              <LabelList dataKey="profit" position="right" formatter={(v) => formatTHB(Number(v))} fill="#cbd5e1" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2 text-xs text-slate-400">คลิกแท่งของเซลล์เพื่อดูรายการงาน</p>

      <Dialog open={selectedRep !== null} onOpenChange={(open) => !open && setSelectedRep(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRep} ({rowsForSelected.length} งาน)
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">เลข JOB</TableHead>
                    <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
                    <TableHead className="text-right whitespace-nowrap">มูลค่า</TableHead>
                    <TableHead className="text-right whitespace-nowrap">ต้นทุน</TableHead>
                    <TableHead className="text-right whitespace-nowrap">กำไร</TableHead>
                    <TableHead className="text-right whitespace-nowrap">%กำไร</TableHead>
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
                      <TableCell className="whitespace-nowrap">{r.customerName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(r.preVat)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(r.costs?.totalCost ?? 0)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(r.profit ?? 0)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{marginPercent(r)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </GpPanel>
  );
}
