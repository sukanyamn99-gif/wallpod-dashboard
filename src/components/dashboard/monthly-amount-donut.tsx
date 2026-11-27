"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatTHB } from "@/lib/format";
import { chartGradient } from "@/lib/chart-gradient";
import { monthKeyOf, monthLabel } from "@/components/dashboard/month-tabs";

const COLORS = ["#3b82f6", "#10b981", "#f5b73c", "#a78bfa", "#f97316", "#6366f1", "#14b8a6", "#ec4899"];

export interface MonthlyDonutSlice {
  // "YYYY-MM"
  key: string;
  label: string;
  count: number;
  amount: number;
}

// One slice per month that has rows, newest first. Rows without a date are skipped.
export function buildMonthlySlices<T>(
  rows: T[],
  dateOf: (row: T) => string | null | undefined,
  amountOf: (row: T) => number,
): MonthlyDonutSlice[] {
  const byMonth = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const key = monthKeyOf(dateOf(row));
    if (!key) continue;
    const entry = byMonth.get(key) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += amountOf(row);
    byMonth.set(key, entry);
  }
  return Array.from(byMonth, ([key, v]) => ({ key, label: monthLabel(key), ...v })).sort((a, b) => b.key.localeCompare(a.key));
}

// 11,767,048.38 -> "11.77 ล้าน" so the total fits inside the ring.
function compact(value: number): string {
  return Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)} ล้าน` : formatNumber(Math.round(value));
}

// The amount of every month as a ring, with the same figures listed beside it.
// Clicking a slice or a month selects that month.
export function MonthlyAmountDonut({
  title,
  countUnit,
  slices,
  selectedKey,
  clickable,
  onSelect,
  className,
}: {
  title: string;
  // What the counted rows are called, e.g. "งาน" or "ใบ".
  countUnit: string;
  // Newest month first.
  slices: MonthlyDonutSlice[];
  // The month being shown, if one is.
  selectedKey: string | null;
  clickable: boolean;
  onSelect: (key: string) => void;
  className?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  // A month with no (or negative) amount can't be drawn as a slice but stays in the list.
  const drawn = slices.filter((s) => s.amount > 0);
  const colorOf = (key: string) => COLORS[Math.max(0, slices.findIndex((s) => s.key === key)) % COLORS.length];

  return (
    <div className={cn("min-w-[380px] flex-1 space-y-2 rounded-lg border p-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--chart-1)]">{title}</p>
        {clickable && <p className="text-xs text-muted-foreground">คลิกเพื่อไปที่เดือนนั้น</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="amount"
                nameKey="label"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                stroke="rgb(8 14 32)"
                strokeWidth={2}
                isAnimationActive={false}
                cursor={clickable ? "pointer" : "default"}
                onClick={(slice) => clickable && onSelect((slice as unknown as MonthlyDonutSlice).key)}
              >
                {drawn.map((s) => (
                  <Cell key={s.key} fill={chartGradient(colorOf(s.key), "d")} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const s = payload[0].payload as MonthlyDonutSlice;
                  return (
                    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                      <p className="font-medium">{s.label}</p>
                      <p className="text-muted-foreground">{formatTHB(s.amount)}</p>
                      <p className="text-muted-foreground">
                        {s.count} {countUnit}
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-muted-foreground">รวม</span>
            <span className="text-xs leading-tight font-semibold tabular-nums">{compact(total)}</span>
          </div>
        </div>

        <ul className="max-h-32 min-w-0 flex-1 space-y-0.5 overflow-y-auto pr-1 text-sm">
          {slices.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(s.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left enabled:hover:bg-muted/60 disabled:cursor-default",
                  s.key === selectedKey && "bg-primary/15 ring-1 ring-primary/60",
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.key) }} />
                <span className="truncate text-muted-foreground">
                  {s.label}
                  <span className="text-xs">
                    {" "}
                    · {s.count} {countUnit}
                  </span>
                </span>
                <span className="ml-auto font-medium tabular-nums">{formatTHB(s.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
