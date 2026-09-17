import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getFuelAllowanceReport } from "@/lib/data/fuel-allowance";
import { calculateFuelAllowance } from "@/lib/fuel-allowance";
import { PrintFuelAllowanceView } from "./print-fuel-allowance-view";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// See quotations/print/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}): Promise<Metadata> {
  const { month, year } = await searchParams;
  const m = Number(month);
  const y = Number(year);
  return { title: m && y ? `ค่าน้ำมัน ${THAI_MONTHS[m - 1]} ${y + 543}` : "ค่าน้ำมันเซลล์" };
}

export default async function PrintFuelAllowancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; reps?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/sale-report")) redirect("/dashboard/sales");

  const { month: monthParam, year: yearParam, reps: repsParam } = await searchParams;
  const month = Number(monthParam);
  const year = Number(yearParam);
  // Selecting the month/eligible reps happens on the calculator page —
  // land back there if this page is reached without a real selection.
  if (!month || !year || month < 1 || month > 12) redirect("/dashboard/sale-report/fuel-allowance");

  const repNames = repsParam ? repsParam.split(",").filter(Boolean) : [];
  const { rows, visitPeriod } = await getFuelAllowanceReport(month, year);

  const visibleRows = repNames.map((name) => {
    const existing = rows.find((r) => r.salesRepName === name);
    if (existing) return existing;
    // Not found means zero sales/visits this month — still floor-tier, same
    // fallback the calculator page itself uses, not a bare zero.
    return { salesRepName: name, visitCount: 0, salesAmount: 0, fuelAmount: calculateFuelAllowance(0, 0).amount };
  });

  return <PrintFuelAllowanceView rows={visibleRows} month={month} year={year} visitPeriod={visitPeriod} />;
}
