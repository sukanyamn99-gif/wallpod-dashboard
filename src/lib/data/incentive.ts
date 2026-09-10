import { getFullProjectReport } from "@/lib/data/project-sales";
import type { IncentiveInstallment, IncentiveReport, IncentiveReportRow } from "@/lib/types";

// Incentive only actually gets paid out for a month once total sales
// (preVat) reach this threshold AND every job that month is fully
// collected — per the user's explicit rule. Below it, the per-job 5%
// column still shows what the incentive *would* be, but the report's own
// eligible flag says it isn't payable yet.
const SALES_THRESHOLD_FOR_PAYOUT = 800_000;

// Fixed split of a job's profit — matches the reference "ค่าคอมมิชชั่นทีม"
// report exactly (70% Koonway / 15% ค่าคอมบริษัท / 5% ค่า Incentive). Not
// user-editable — the reference report treats these as constants, not a
// per-run input.
const KOONWAY_PERCENT = 70;
const COMPANY_COMMISSION_PERCENT = 15;
const INCENTIVE_PERCENT = 5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildInstallments(row: {
  amount1: number | null;
  invoiceNo1: string | null;
  taxInvoiceNo1: string | null;
  paidDate1: string | null;
  receiptNo1: string | null;
  amount2: number | null;
  invoiceNo2: string | null;
  taxInvoiceNo2: string | null;
  paidDate2: string | null;
  receiptNo2: string | null;
  amount3: number | null;
  invoiceNo3: string | null;
  taxInvoiceNo3: string | null;
  paidDate3: string | null;
  receiptNo3: string | null;
}): IncentiveInstallment[] {
  const raw = [
    { amount: row.amount1, invoiceNo: row.taxInvoiceNo1 ?? row.invoiceNo1, paidDate: row.paidDate1, receiptNo: row.receiptNo1 },
    { amount: row.amount2, invoiceNo: row.taxInvoiceNo2 ?? row.invoiceNo2, paidDate: row.paidDate2, receiptNo: row.receiptNo2 },
    { amount: row.amount3, invoiceNo: row.taxInvoiceNo3 ?? row.invoiceNo3, paidDate: row.paidDate3, receiptNo: row.receiptNo3 },
  ].filter((r) => r.amount != null && r.amount > 0) as { amount: number; invoiceNo: string | null; paidDate: string | null; receiptNo: string | null }[];

  const total = raw.reduce((sum, r) => sum + r.amount, 0);
  return raw.map((r, i) => ({
    label: `งวดที่ ${i + 1}`,
    percentOfTotal: total > 0 ? round2((r.amount / total) * 100) : 0,
    amountWithVat: r.amount,
    invoiceNo: r.invoiceNo,
    paidDate: r.paidDate,
    receiptNo: r.receiptNo,
  }));
}

export async function getIncentiveReport(month: number, year: number): Promise<IncentiveReport> {
  const { rows: allRows } = await getFullProjectReport();

  const monthRows = allRows.filter((r) => {
    if (r.isCancelled || !r.projectDate) return false;
    const d = new Date(r.projectDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const rows: IncentiveReportRow[] = monthRows.map((r) => {
    // Costs not yet entered for this job — profit/splits are an honest gap,
    // not assumed to be zero (matches GP Dashboard's identical convention).
    const totalCost = r.costs ? r.costs.totalCost : null;
    const profit = r.costs ? r.profit : null;
    const profitPercent = profit != null && r.preVat > 0 ? round2((profit / r.preVat) * 100) : null;

    return {
      projectId: r.id,
      jobNo: r.jobNo,
      projectDate: r.projectDate,
      customerName: r.customerName,
      projectName: r.projectName,
      salesRepName: r.salesRepName,
      preVat: r.preVat,
      totalCost,
      profit,
      profitPercent,
      installments: buildInstallments(r),
      koonwayShare: profit != null ? round2(profit * (KOONWAY_PERCENT / 100)) : null,
      companyCommission: profit != null ? round2(profit * (COMPANY_COMMISSION_PERCENT / 100)) : null,
      incentiveAmount: profit != null ? round2(profit * (INCENTIVE_PERCENT / 100)) : null,
      status: r.status,
    };
  });

  rows.sort((a, b) => (a.jobNo ?? "").localeCompare(b.jobNo ?? "", undefined, { numeric: true }));

  const totals = rows.reduce(
    (acc, r) => ({
      preVat: acc.preVat + r.preVat,
      totalCost: acc.totalCost + (r.totalCost ?? 0),
      profit: acc.profit + (r.profit ?? 0),
      profitPercent: 0, // computed after the reduce, from the accumulated totals
      amountWithVat: acc.amountWithVat + r.installments.reduce((s, it) => s + it.amountWithVat, 0),
      koonwayShare: acc.koonwayShare + (r.koonwayShare ?? 0),
      companyCommission: acc.companyCommission + (r.companyCommission ?? 0),
      incentiveAmount: acc.incentiveAmount + (r.incentiveAmount ?? 0),
    }),
    { preVat: 0, totalCost: 0, profit: 0, profitPercent: 0, amountWithVat: 0, koonwayShare: 0, companyCommission: 0, incentiveAmount: 0 },
  );
  totals.profitPercent = totals.preVat > 0 ? round2((totals.profit / totals.preVat) * 100) : 0;

  const totalSales = totals.preVat;
  // Only counts as "all collected" when there's at least one job — an empty
  // month has nothing to collect, so it shouldn't read as trivially eligible.
  const allCollected = rows.length > 0 && rows.every((r) => r.status === "เก็บเงินเรียบร้อย");
  const eligible = totalSales >= SALES_THRESHOLD_FOR_PAYOUT && allCollected;

  return { month, year, rows, totals, totalSales, allCollected, eligible };
}
