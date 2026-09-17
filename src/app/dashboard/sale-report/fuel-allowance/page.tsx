import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getFuelAllowanceReport } from "@/lib/data/fuel-allowance";
import { FuelAllowanceView } from "./fuel-allowance-view";

export default async function FuelAllowancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/sale-report")) redirect("/dashboard/sales");

  const { month: monthParam, year: yearParam } = await searchParams;
  const now = new Date();
  const month = Number(monthParam) || now.getMonth() + 1;
  const year = Number(yearParam) || now.getFullYear();

  const { rows, allNames, visitPeriod } = await getFuelAllowanceReport(month, year);

  return <FuelAllowanceView rows={rows} allNames={allNames} visitPeriod={visitPeriod} month={month} year={year} />;
}
