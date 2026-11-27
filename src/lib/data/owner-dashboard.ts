import { getFullProjectReport } from "@/lib/data/project-sales";
import { getArDashboardData } from "@/lib/data/ar";
import { getPayablesDashboardData } from "@/lib/data/payables";
import { getStockDashboardData } from "@/lib/data/stock";
import { getBankAccounts, getBankTransactions } from "@/lib/data/bank-accounts";

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
  bankBalanceTotal: number;
  // One point per month of the year so far (January to this month), for the
  // little curves on the cards. Balances that have no history on record
  // (receivables, payables, stock) have none.
  sparklines: {
    sales: number[];
    cost: number[];
    profit: number[];
    margin: number[];
    bank: number[];
  };
}

// One consolidated "business health" snapshot for the owner, combining
// figures each dashboard already computes on its own (Sales/GP for the
// year's flow, AR/Payables/Stock for today's balances) rather than
// re-deriving anything new — this page is a summary, not a new source of
// truth.
export async function getOwnerDashboardData(): Promise<OwnerDashboardData> {
  const year = new Date().getFullYear();

  const [{ rows }, ar, payables, stock, bankAccounts] = await Promise.all([
    getFullProjectReport(),
    getArDashboardData(),
    getPayablesDashboardData(),
    getStockDashboardData(),
    getBankAccounts(),
  ]);

  const yearRows = rows.filter((r) => !r.isCancelled && new Date(r.projectDate).getFullYear() === year);
  const yearlySales = yearRows.reduce((sum, r) => sum + r.preVat, 0);

  // Cost/profit can only be summed over jobs that actually have cost data
  // entered — same honest-gap convention GP Dashboard already uses, surfaced
  // here as yearlyCostedJobCount so the KPI card can say so rather than
  // implying 100% coverage. The margin % must divide profit by the SALES OF
  // THOSE SAME costed jobs (not all of yearlySales) — otherwise revenue from
  // jobs with no cost data dilutes the denominator and understates the
  // margin, which is what made this drift from GP Dashboard's own
  // totalProfit/totalPreVat (computed over the same costed population).
  const costedYearRows = yearRows.filter((r) => r.costs !== null && r.profit !== null);
  const costedYearSales = costedYearRows.reduce((sum, r) => sum + r.preVat, 0);
  const yearlyCost = costedYearRows.reduce((sum, r) => sum + (r.costs?.totalCost ?? 0), 0);
  const yearlyProfit = costedYearRows.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  const yearlyMarginPercent = costedYearSales > 0 ? (yearlyProfit / costedYearSales) * 100 : 0;

  // Month-by-month series for the year so far.
  const now = new Date();
  const monthKeys = Array.from({ length: now.getMonth() + 1 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthOf = (date: string) => date.slice(0, 7);
  const bySum = (list: typeof yearRows, key: string, pick: (r: (typeof yearRows)[number]) => number) =>
    list.filter((r) => monthOf(r.projectDate) === key).reduce((sum, r) => sum + pick(r), 0);
  const salesSeries = monthKeys.map((key) => bySum(yearRows, key, (r) => r.preVat));
  const costSeries = monthKeys.map((key) => bySum(costedYearRows, key, (r) => r.costs?.totalCost ?? 0));
  const profitSeries = monthKeys.map((key) => bySum(costedYearRows, key, (r) => r.profit ?? 0));
  const marginSeries = monthKeys.map((key) => {
    const sales = bySum(costedYearRows, key, (r) => r.preVat);
    return sales > 0 ? (bySum(costedYearRows, key, (r) => r.profit ?? 0) / sales) * 100 : 0;
  });

  // The balance at the end of each month: today's balance wound back through
  // every movement recorded after that month ended.
  const bankBalanceTotal = bankAccounts.reduce((sum, a) => sum + a.systemBalance, 0);
  const bankTransactions = await getBankTransactions(bankAccounts);
  const bankSeries = monthKeys.map((key, i) => {
    if (i === monthKeys.length - 1) return bankBalanceTotal;
    const [y, m] = key.split("-").map(Number);
    const monthEnd = `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    const later = bankTransactions.filter((t) => t.date > monthEnd);
    const movedIn = later.filter((t) => t.type === "in").reduce((sum, t) => sum + t.amount, 0);
    const movedOut = later.filter((t) => t.type === "out").reduce((sum, t) => sum + t.amount, 0);
    return bankBalanceTotal - movedIn + movedOut;
  });

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
    // ยอดในระบบ (computed from opening_balance + recorded inflow/outflow) —
    // not ยอดในธนาคาร, which only ever moves when someone manually re-syncs
    // it against the real bank statement and can go stale between syncs.
    // Per the user's explicit choice: this card should track what the
    // system itself has recorded, not that manual snapshot.
    bankBalanceTotal,
    sparklines: { sales: salesSeries, cost: costSeries, profit: profitSeries, margin: marginSeries, bank: bankSeries },
  };
}
