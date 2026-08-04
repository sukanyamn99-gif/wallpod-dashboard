import { endOfMonth, format, isWithinInterval, startOfMonth, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { getFullProjectReport } from "@/lib/data/project-sales";
import type { FullProjectRow } from "@/lib/data/project-sales";

const MONTHS_TO_SHOW = 8;

export interface GpDashboardData {
  kpis: {
    totalPreVat: number;
    totalCost: number;
    totalProfit: number;
    avgMarginPercent: number;
    costedJobCount: number;
  };
  bySalesRep: { salesRepId: string; salesRepName: string; profit: number; preVat: number; jobCount: number }[];
  byCustomerType: { type: string; profit: number }[];
  monthlyTrend: { monthLabel: string; profit: number }[];
  marginExtremes: { top: FullProjectRow[]; bottom: FullProjectRow[] };
}

type CostedRow = FullProjectRow & { costs: NonNullable<FullProjectRow["costs"]>; profit: number };

function isCosted(row: FullProjectRow): row is CostedRow {
  return !row.isCancelled && row.costs !== null && row.profit !== null;
}

function getMonthRange(rows: CostedRow[]) {
  const now = new Date();
  const months = Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
    const monthAnchor = subMonths(now, MONTHS_TO_SHOW - 1 - i);
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    return { start, end, label: format(start, "MMM yy", { locale: th }) };
  });

  const firstWithData = months.findIndex(({ start, end }) =>
    rows.some((r) => isWithinInterval(new Date(r.projectDate), { start, end })),
  );
  return firstWithData === -1 ? months : months.slice(firstWithData);
}

export async function getGpDashboardData(): Promise<GpDashboardData> {
  const { rows } = await getFullProjectReport();
  const costed = rows.filter(isCosted);

  const totalPreVat = costed.reduce((sum, r) => sum + r.preVat, 0);
  const totalCost = costed.reduce((sum, r) => sum + r.costs.totalCost, 0);
  const totalProfit = costed.reduce((sum, r) => sum + r.profit, 0);
  const avgMarginPercent = totalPreVat > 0 ? (totalProfit / totalPreVat) * 100 : 0;

  const repIds = Array.from(new Set(costed.map((r) => r.salesRepName)));
  const bySalesRep = repIds
    .map((salesRepName) => {
      const repRows = costed.filter((r) => r.salesRepName === salesRepName);
      return {
        salesRepId: salesRepName,
        salesRepName,
        profit: repRows.reduce((sum, r) => sum + r.profit, 0),
        preVat: repRows.reduce((sum, r) => sum + r.preVat, 0),
        jobCount: repRows.length,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const customerTypes = Array.from(new Set(costed.map((r) => r.customerType)));
  const byCustomerType = customerTypes
    .map((type) => ({
      type,
      profit: costed.filter((r) => r.customerType === type).reduce((sum, r) => sum + r.profit, 0),
    }))
    .sort((a, b) => b.profit - a.profit);

  const months = getMonthRange(costed);
  const monthlyTrend = months.map(({ start, end, label }) => ({
    monthLabel: label,
    profit: costed
      .filter((r) => isWithinInterval(new Date(r.projectDate), { start, end }))
      .reduce((sum, r) => sum + r.profit, 0),
  }));

  const withMargin = costed
    .filter((r) => r.preVat > 0)
    .map((r) => ({ row: r, marginPercent: (r.profit / r.preVat) * 100 }))
    .sort((a, b) => b.marginPercent - a.marginPercent);
  const top = withMargin.slice(0, 5).map((w) => w.row);
  const bottom = withMargin
    .slice(-5)
    .reverse()
    .map((w) => w.row);

  return {
    kpis: { totalPreVat, totalCost, totalProfit, avgMarginPercent, costedJobCount: costed.length },
    bySalesRep,
    byCustomerType,
    monthlyTrend,
    marginExtremes: { top, bottom },
  };
}
