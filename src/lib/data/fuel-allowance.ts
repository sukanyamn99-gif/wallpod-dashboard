import { getFullProjectReport } from "@/lib/data/project-sales";
import { getAllSaleReports } from "@/lib/data/sale-reports";
import { calculateFuelAllowance } from "@/lib/fuel-allowance";
import type { FuelAllowanceRow } from "@/lib/types";

export interface FuelAllowanceReport {
  // Every sales rep name ever seen in Sale Report or WALLPOD Project Sales
  // (not just this month) — not everyone on this list is actually entitled
  // to a fuel allowance (that's a separate, user-picked eligibility list on
  // the page itself, since who qualifies is a business decision, not
  // something derivable from the data). This just gives the UI a complete
  // set of names to offer as options.
  allNames: string[];
  rows: FuelAllowanceRow[];
  // The actual date range ("YYYY-MM-DD") used to count จำนวนลูกค้าที่วิ่ง —
  // surfaced so the report itself states the cutoff instead of leaving the
  // 25th-to-25th rule as something only the code knows about.
  visitPeriod: { from: string; to: string };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// The visit-count cutoff runs the 25th of the previous month through the
// 25th of this month, inclusive both ends — e.g. the figure paid at the end
// of September counts visits from Aug 25 through Sep 25 (confirmed
// explicitly by the user; this cutoff does NOT apply to ยอดขาย, which stays
// on the plain calendar month per project_date). Comparing the "YYYY-MM-DD"
// prefix of created_at as a string (not a parsed Date) matches this
// function's existing convention below for sales amount, and sorts
// correctly since that format is lexicographically ordered the same as
// chronologically.
function visitPeriodBounds(month: number, year: number): { from: string; to: string } {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return { from: `${prevYear}-${pad2(prevMonth)}-25`, to: `${year}-${pad2(month)}-25` };
}

// "ยอดขาย" is real closed revenue from WALLPOD Project Sales (pre_vat,
// bucketed by the job's own project_date — matches how every other monthly
// sales figure in this app, e.g. GP/AR/weekly sales, is bucketed), not the
// self-reported pipeline value on a Sale Report entry. "จำนวนลูกค้าที่วิ่ง"
// is every Sale Report entry that rep filed in the visit-count cutoff
// window above, one row = one visit, with no dedupe by customer name.
export async function getFuelAllowanceReport(month: number, year: number): Promise<FuelAllowanceReport> {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const visitBounds = visitPeriodBounds(month, year);

  const [reports, { rows: projects }] = await Promise.all([getAllSaleReports(), getFullProjectReport()]);

  const visitCounts = new Map<string, number>();
  for (const r of reports) {
    const visitDate = r.created_at.slice(0, 10);
    if (visitDate < visitBounds.from || visitDate > visitBounds.to) continue;
    visitCounts.set(r.sales_rep_name, (visitCounts.get(r.sales_rep_name) ?? 0) + 1);
  }

  const salesAmounts = new Map<string, number>();
  for (const p of projects) {
    if (p.isCancelled || !p.projectDate.startsWith(monthPrefix)) continue;
    salesAmounts.set(p.salesRepName, (salesAmounts.get(p.salesRepName) ?? 0) + p.preVat);
  }

  // Every rep ever seen, not just ones active this month — a rep with zero
  // sales/visits this month still gets a row at the floor tier instead of
  // silently disappearing from the report.
  const allNames = new Set<string>([...reports.map((r) => r.sales_rep_name), ...projects.map((p) => p.salesRepName)]);

  const rows = Array.from(allNames)
    .map((salesRepName) => {
      const visitCount = visitCounts.get(salesRepName) ?? 0;
      const salesAmount = salesAmounts.get(salesRepName) ?? 0;
      const tier = calculateFuelAllowance(salesAmount, visitCount);
      return { salesRepName, visitCount, salesAmount, fuelAmount: tier.amount };
    })
    .sort((a, b) => b.fuelAmount - a.fuelAmount || b.salesAmount - a.salesAmount);

  return { allNames: Array.from(allNames).sort(), rows, visitPeriod: visitBounds };
}
