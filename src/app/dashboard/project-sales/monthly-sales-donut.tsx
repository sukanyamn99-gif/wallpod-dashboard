"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatTHB } from "@/lib/format";

const COLORS = ["#3b82f6", "#10b981", "#f5b73c", "#a78bfa", "#f97316", "#6366f1", "#14b8a6", "#ec4899"];

export interface MonthlySalesSlice {
  key: string;
  label: string;
  year: string;
  count: number;
  // Sales before VAT, cancelled jobs left out.
  preVat: number;
  // Page of the table this month is on.
  index: number;
}

// 11,767,048.38 -> "11.77 ล้าน" so the total fits inside the ring.
function compact(value: number): string {
  return Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)} ล้าน` : formatNumber(Math.round(value));
}

// The sales of every month in view as a ring, with the same figures listed
// beside it. Clicking a slice or a month jumps the table to that month.
export function MonthlySalesDonut({
  slices,
  currentIndex,
  clickable,
  onSelect,
}: {
  // Newest month first.
  slices: MonthlySalesSlice[];
  // The month the table is showing, if it is showing one month at a time.
  currentIndex: number | null;
  clickable: boolean;
  onSelect: (index: number) => void;
}) {
  const total = slices.reduce((sum, s) => sum + s.preVat, 0);
  // A month with no (or negative) sales can't be drawn as a slice but stays in the list.
  const drawn = slices.filter((s) => s.preVat > 0);
  const colorOf = (key: string) => COLORS[Math.max(0, slices.findIndex((s) => s.key === key)) % COLORS.length];

  return (
    <div className="min-w-[380px] flex-1 space-y-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--chart-1)]">ยอดขายแต่ละเดือน (ก่อน VAT)</p>
        {clickable && <p className="text-xs text-muted-foreground">คลิกเพื่อไปที่เดือนนั้น</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="preVat"
                nameKey="label"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                stroke="rgb(8 14 32)"
                strokeWidth={2}
                isAnimationActive={false}
                cursor={clickable ? "pointer" : "default"}
                onClick={(slice) => clickable && onSelect((slice as unknown as MonthlySalesSlice).index)}
              >
                {drawn.map((s) => (
                  <Cell key={s.key} fill={colorOf(s.key)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const s = payload[0].payload as MonthlySalesSlice;
                  return (
                    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                      <p className="font-medium">
                        {s.label} {s.year}
                      </p>
                      <p className="text-muted-foreground">{formatTHB(s.preVat)}</p>
                      <p className="text-muted-foreground">{s.count} งาน</p>
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
          {slices.map((s) => {
            const share = total > 0 && s.preVat > 0 ? Math.round((s.preVat / total) * 100) : null;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSelect(s.index)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left enabled:hover:bg-muted/60 disabled:cursor-default",
                    s.index === currentIndex && "bg-primary/15 ring-1 ring-primary/60",
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.key) }} />
                  <span className="truncate text-muted-foreground">
                    {s.label} {s.year}
                    <span className="text-xs"> · {s.count} งาน{share !== null ? ` · ${share}%` : ""}</span>
                  </span>
                  <span className="ml-auto font-medium tabular-nums">{formatTHB(s.preVat)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
