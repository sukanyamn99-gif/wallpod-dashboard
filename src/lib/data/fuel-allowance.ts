import { getFullProjectReport } from "@/lib/data/project-sales";
import { getAllSaleReports } from "@/lib/data/sale-reports";
import { calculateFuelAllowance } from "@/lib/fuel-allowance";
import type { FuelAllowanceRow } from "@/lib/types";

// "ยอดขาย" is real closed revenue from WALLPOD Project Sales (pre_vat,
// bucketed by the job's own project_date — matches how every other monthly
// sales figure in this app, e.g. GP/AR/weekly sales, is bucketed), not the
// self-reported pipeline value on a Sale Report entry. "จำนวนลูกค้าที่วิ่ง"
// is every Sale Report entry that rep filed in the month, one row = one
// visit, with no dedupe by customer name.
export async function getFuelAllowanceReport(month: number, year: number): Promise<FuelAllowanceRow[]> {
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

  const names = new Set<string>([...visitCounts.keys(), ...salesAmounts.keys()]);

  return Array.from(names)
    .map((salesRepName) => {
      const visitCount = visitCounts.get(salesRepName) ?? 0;
      const salesAmount = salesAmounts.get(salesRepName) ?? 0;
      const tier = calculateFuelAllowance(salesAmount, visitCount);
      return { salesRepName, visitCount, salesAmount, fuelAmount: tier.amount };
    })
    .sort((a, b) => b.fuelAmount - a.fuelAmount || b.salesAmount - a.salesAmount);
}
