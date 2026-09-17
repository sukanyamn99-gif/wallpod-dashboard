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
}

// "ยอดขาย" is real closed revenue from WALLPOD Project Sales (pre_vat,
// bucketed by the job's own project_date — matches how every other monthly
// sales figure in this app, e.g. GP/AR/weekly sales, is bucketed), not the
// self-reported pipeline value on a Sale Report entry. "จำนวนลูกค้าที่วิ่ง"
// is every Sale Report entry that rep filed in the month, one row = one
// visit, with no dedupe by customer name.
export async function getFuelAllowanceReport(month: number, year: number): Promise<FuelAllowanceReport> {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const [reports, { rows: projects }] = await Promise.all([getAllSaleReports(), getFullProjectReport()]);

  const visitCounts = new Map<string, number>();
  for (const r of reports) {
    if (!r.created_at.startsWith(monthPrefix)) continue;
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

  return { allNames: Array.from(allNames).sort(), rows };
}
