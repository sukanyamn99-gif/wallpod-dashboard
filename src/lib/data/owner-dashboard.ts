import { getFullProjectReport } from "@/lib/data/project-sales";
import { getArDashboardData } from "@/lib/data/ar";
import { getPayablesDashboardData } from "@/lib/data/payables";
import { getStockDashboardData } from "@/lib/data/stock";

export interface OwnerDashboardData {
  year: number;
  yearlySales: number;
  yearlyCost: number;
  yearlyProfit: number;
  yearlyMarginPercent: number;
  yearlyJobCount: number;
  yearlyCostedJobCount: number;
  receivablesTotal: number;
  payablesTotal: number;
  stockValue: number;
}

// One consolidated "business health" snapshot for the owner, combining
// figures each dashboard already computes on its own (Sales/GP for the
// year's flow, AR/Payables/Stock for today's balances) rather than
// re-deriving anything new — this page is a summary, not a new source of
// truth.
export async function getOwnerDashboardData(): Promise<OwnerDashboardData> {
  const year = new Date().getFullYear();

  const [{ rows }, ar, payables, stock] = await Promise.all([
    getFullProjectReport(),
    getArDashboardData(),
    getPayablesDashboardData(),
    getStockDashboardData(),
  ]);

  const yearRows = rows.filter((r) => !r.isCancelled && new Date(r.projectDate).getFullYear() === year);
  const yearlySales = yearRows.reduce((sum, r) => sum + r.preVat, 0);

  // Cost/profit can only be summed over jobs that actually have cost data
  // entered — same honest-gap convention GP Dashboard already uses, surfaced
  // here as yearlyCostedJobCount so the KPI card can say so rather than
  // implying 100% coverage.
  const costedYearRows = yearRows.filter((r) => r.costs !== null && r.profit !== null);
  const yearlyCost = costedYearRows.reduce((sum, r) => sum + (r.costs?.totalCost ?? 0), 0);
  const yearlyProfit = costedYearRows.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  const yearlyMarginPercent = yearlySales > 0 ? (yearlyProfit / yearlySales) * 100 : 0;

  return {
    year,
    yearlySales,
    yearlyCost,
    yearlyProfit,
    yearlyMarginPercent,
    yearlyJobCount: yearRows.length,
    yearlyCostedJobCount: costedYearRows.length,
    receivablesTotal: ar.kpis.totalOutstanding,
    payablesTotal: payables.kpis.totalOutstanding,
    stockValue: stock.totalStockValue,
  };
}
