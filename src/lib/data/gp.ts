import { getFullProjectReport } from "@/lib/data/project-sales";
import type { FullProjectRow } from "@/lib/data/project-sales";

const MONTHS_TO_SHOW = 8;
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const UNSPECIFIED_CATEGORY = "ไม่ระบุ";

export interface GpKpiDeltas {
  // % change against the same figure in the previous period; null when there is
  // no previous period to compare with (all years, or nothing booked then).
  preVat: number | null;
  cost: number | null;
  profit: number | null;
  // Margin is compared in percentage points, not as a percent of a percent.
  marginPoints: number | null;
}

export interface GpDashboardData {
  period: {
    // null = every year
    year: number | null;
    label: string;
    previousLabel: string | null;
  };
  availableYears: number[];
  kpis: {
    totalPreVat: number;
    totalCost: number;
    totalProfit: number;
    avgMarginPercent: number;
    costedJobCount: number;
    deltas: GpKpiDeltas;
  };
  // One point per month shown in the trend chart, for the little curves on the KPI cards.
  sparklines: { preVat: number[]; cost: number[]; profit: number[]; margin: number[] };
  bySalesRep: { salesRepId: string; salesRepName: string; profit: number; preVat: number; jobCount: number }[];
  byCustomerType: { type: string; profit: number }[];
  // A job's profit is split across its product groups by their share of the
  // job's item amounts — the costs are kept per job, not per product.
  byProductCategory: { category: string; profit: number; preVat: number }[];
  monthlyTrend: { monthKey: string; monthLabel: string; profit: number; preVat: number; marginPercent: number }[];
  marginExtremes: { top: FullProjectRow[]; bottom: FullProjectRow[] };
  list: FullProjectRow[];
}

type CostedRow = FullProjectRow & { costs: NonNullable<FullProjectRow["costs"]>; profit: number };

function isCosted(row: FullProjectRow): row is CostedRow {
  return !row.isCancelled && row.costs !== null && row.profit !== null;
}

// Read straight off the date string so a job near midnight never slips into the
// neighbouring month or year.
function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}
function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

// "เม.ย. 69": short Thai month and the two-digit Buddhist year.
function monthLabelOf(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${THAI_MONTHS_SHORT[month - 1]} ${String(year + 543).slice(-2)}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function marginOf(profit: number, preVat: number): number {
  return preVat > 0 ? (profit / preVat) * 100 : 0;
}

// The months the trend chart (and the KPI curves) cover: the latest few months
// for "all years", otherwise every month of the chosen year up to today.
function monthKeysFor(rows: CostedRow[], year: number | null): string[] {
  const nowKey = currentMonthKey();
  if (year !== null) {
    const keys: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      if (key <= nowKey) keys.push(key);
    }
    const firstWithData = keys.findIndex((key) => rows.some((r) => monthKeyOf(r.projectDate) === key));
    return firstWithData === -1 ? keys : keys.slice(firstWithData);
  }

  const [nowYear, nowMonth] = nowKey.split("-").map(Number);
  const keys = Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
    const d = new Date(nowYear, nowMonth - 1 - (MONTHS_TO_SHOW - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const firstWithData = keys.findIndex((key) => rows.some((r) => monthKeyOf(r.projectDate) === key));
  return firstWithData === -1 ? keys : keys.slice(firstWithData);
}

// "auto" opens on the current year when it has jobs, otherwise on every year.
export type GpYearParam = number | "all" | "auto";

export async function getGpDashboardData(yearParam: GpYearParam = "auto"): Promise<GpDashboardData> {
  const { rows } = await getFullProjectReport();
  const allCosted = rows.filter(isCosted);

  const availableYears = Array.from(new Set(allCosted.map((r) => yearOf(r.projectDate))))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);

  const thisYear = new Date().getFullYear();
  const year: number | null =
    yearParam === "all" ? null : yearParam === "auto" ? (availableYears.includes(thisYear) ? thisYear : null) : yearParam;

  const costed = year === null ? allCosted : allCosted.filter((r) => yearOf(r.projectDate) === year);
  const previous = year === null ? [] : allCosted.filter((r) => yearOf(r.projectDate) === year - 1);

  const totalPreVat = sum(costed, (r) => r.preVat);
  const totalCost = sum(costed, (r) => r.costs.totalCost);
  const totalProfit = sum(costed, (r) => r.profit);
  const avgMarginPercent = marginOf(totalProfit, totalPreVat);

  const prevPreVat = sum(previous, (r) => r.preVat);
  const prevCost = sum(previous, (r) => r.costs.totalCost);
  const prevProfit = sum(previous, (r) => r.profit);
  const hasPrevious = year !== null && previous.length > 0;
  const deltas: GpKpiDeltas = {
    preVat: hasPrevious ? percentChange(totalPreVat, prevPreVat) : null,
    cost: hasPrevious ? percentChange(totalCost, prevCost) : null,
    profit: hasPrevious ? percentChange(totalProfit, prevProfit) : null,
    marginPoints: hasPrevious && prevPreVat > 0 ? avgMarginPercent - marginOf(prevProfit, prevPreVat) : null,
  };

  const repNames = Array.from(new Set(costed.map((r) => r.salesRepName)));
  const bySalesRep = repNames
    .map((salesRepName) => {
      const repRows = costed.filter((r) => r.salesRepName === salesRepName);
      return {
        salesRepId: salesRepName,
        salesRepName,
        profit: sum(repRows, (r) => r.profit),
        preVat: sum(repRows, (r) => r.preVat),
        jobCount: repRows.length,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const customerTypes = Array.from(new Set(costed.map((r) => r.customerType)));
  const byCustomerType = customerTypes
    .map((type) => ({
      type,
      profit: sum(
        costed.filter((r) => r.customerType === type),
        (r) => r.profit,
      ),
    }))
    .sort((a, b) => b.profit - a.profit);

  const categoryTotals = new Map<string, { profit: number; preVat: number }>();
  for (const r of costed) {
    const items = Object.entries(r.itemsByCategory).filter(([, amount]) => amount > 0);
    const itemsTotal = items.reduce((total, [, amount]) => total + amount, 0);
    const parts: [string, number][] = itemsTotal > 0 ? items.map(([cat, amount]) => [cat, amount / itemsTotal]) : [[UNSPECIFIED_CATEGORY, 1]];
    for (const [category, share] of parts) {
      const entry = categoryTotals.get(category) ?? { profit: 0, preVat: 0 };
      entry.profit += r.profit * share;
      entry.preVat += r.preVat * share;
      categoryTotals.set(category, entry);
    }
  }
  const byProductCategory = Array.from(categoryTotals, ([category, v]) => ({ category, ...v })).sort((a, b) => b.profit - a.profit);

  const monthKeys = monthKeysFor(costed, year);
  const monthlyTrend = monthKeys.map((key) => {
    const monthRows = costed.filter((r) => monthKeyOf(r.projectDate) === key);
    const profit = sum(monthRows, (r) => r.profit);
    const preVat = sum(monthRows, (r) => r.preVat);
    return { monthKey: key, monthLabel: monthLabelOf(key), profit, preVat, marginPercent: marginOf(profit, preVat) };
  });
  const monthCost = monthKeys.map((key) =>
    sum(
      costed.filter((r) => monthKeyOf(r.projectDate) === key),
      (r) => r.costs.totalCost,
    ),
  );

  const withMargin = costed
    .filter((r) => r.preVat > 0)
    .map((r) => ({ row: r, marginPercent: (r.profit / r.preVat) * 100 }))
    .sort((a, b) => b.marginPercent - a.marginPercent);
  const top = withMargin.slice(0, 10).map((w) => w.row);
  const bottom = withMargin
    .slice(-10)
    .reverse()
    .map((w) => w.row);

  return {
    period: {
      year,
      label: year === null ? "ทุกปี" : `ปี ${year + 543}`,
      previousLabel: hasPrevious && year !== null ? `ปี ${year - 1 + 543}` : null,
    },
    availableYears,
    kpis: { totalPreVat, totalCost, totalProfit, avgMarginPercent, costedJobCount: costed.length, deltas },
    sparklines: {
      preVat: monthlyTrend.map((m) => m.preVat),
      cost: monthCost,
      profit: monthlyTrend.map((m) => m.profit),
      margin: monthlyTrend.map((m) => m.marginPercent),
    },
    bySalesRep,
    byCustomerType,
    byProductCategory,
    monthlyTrend,
    marginExtremes: { top, bottom },
    list: costed,
  };
}
