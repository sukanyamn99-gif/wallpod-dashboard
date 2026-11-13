"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { formatTHB } from "@/lib/format";

// One month picker shared by every document list. The chosen month is kept in
// localStorage under a single key, so going into a document and coming back —
// or opening another document list — stays on the same month instead of
// starting over. "all" shows every month.
const STORAGE_KEY = "doc-list-month";
const CHANGE_EVENT = "doc-list-month-change";
export const ALL_MONTHS = "all";

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-11-12" or an ISO timestamp -> "2026-11". Sliced, not parsed, so a date
// near midnight never slips into the neighbouring month.
export function monthKeyOf(date: string | null | undefined): string {
  if (!date) return "";
  // A bare date is sliced as is. A timestamp (created_at) is read in Thai time,
  // so a document made just after midnight on the 1st stays in its own month.
  if (date.length <= 10) return date.slice(0, 7);
  return new Date(date).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return `${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// The selected month: the saved choice, otherwise the current month.
export function useDocMonth(): [string, (value: string) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(),
    () => null,
  );
  const value = stored ?? currentMonthKey();
  const setValue = useCallback((next: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [value, setValue];
}

export function filterByMonth<T>(rows: T[], dateOf: (row: T) => string | null | undefined, month: string): T[] {
  if (month === ALL_MONTHS) return rows;
  return rows.filter((row) => monthKeyOf(dateOf(row)) === month);
}

// Month tabs across the top of a list: ทั้งหมด, then every month that has a
// document (newest first), always including the current and selected months so
// the highlighted tab never disappears.
export function MonthTabs({
  dates,
  value,
  onChange,
  total,
  count,
  breakdown,
}: {
  dates: (string | null | undefined)[];
  value: string;
  onChange: (value: string) => void;
  // The month's total split by outcome (e.g. quotations won / lost / pending).
  breakdown?: { label: string; amount: number; count: number; tone: "good" | "bad" | "pending" }[];
  // The pre-VAT total (and number of documents) of the selected month, shown
  // at the right of the tabs. Left out on lists that carry no amounts.
  total?: number;
  count?: number;
}) {
  const months = useMemo(() => {
    const keys = new Set<string>([currentMonthKey()]);
    for (const d of dates) {
      const key = monthKeyOf(d);
      if (key) keys.add(key);
    }
    if (value !== ALL_MONTHS) keys.add(value);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [dates, value]);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="เลือกเดือน">
        <MonthTab active={value === ALL_MONTHS} onClick={() => onChange(ALL_MONTHS)}>
          ทั้งหมด
        </MonthTab>
        {months.map((key) => (
          <MonthTab key={key} active={value === key} onClick={() => onChange(key)}>
            {monthLabel(key)}
          </MonthTab>
        ))}
      </div>
      {total !== undefined && (
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">
            ยอดรวมก่อน VAT · {value === ALL_MONTHS ? "ทั้งหมด" : monthLabel(value)}
            {count !== undefined && ` · ${count} รายการ`}
          </p>
          <p className="text-2xl leading-tight font-semibold tabular-nums">{formatTHB(total)}</p>
          {breakdown && breakdown.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-end gap-x-4 gap-y-0.5 text-sm tabular-nums">
              {breakdown.map((b) => (
                <span
                  key={b.label}
                  className={cn(
                    "whitespace-nowrap",
                    b.tone === "good" && "text-emerald-600 dark:text-emerald-400",
                    b.tone === "bad" && "text-rose-600 dark:text-rose-400",
                    b.tone === "pending" && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {b.label} {formatTHB(b.amount)} ({b.count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
