import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getIncentiveReport } from "@/lib/data/incentive";
import { PrintIncentiveView } from "./print-incentive-view";

// See quotations/print/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}): Promise<Metadata> {
  const { month, year } = await searchParams;
  return { title: month && year ? `ค่า Incentive ${month}-${year}` : "ค่า Incentive" };
}

export default async function PrintIncentivePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; names?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/incentive")) redirect("/dashboard/sales");

  const { month: monthParam, year: yearParam, names: namesParam } = await searchParams;
  const month = Number(monthParam);
  const year = Number(yearParam);
  // Selecting the month happens on the main incentive page (MonthSelector)
  // rather than as a step on this page — land back there if this page is
  // reached without a real selection.
  if (!month || !year || month < 1 || month > 12) redirect("/dashboard/expenses/incentive");

  const names = namesParam
    ? namesParam.split(",").map((n) => n.trim()).filter(Boolean)
    : [];
  const report = await getIncentiveReport(month, year);

  return <PrintIncentiveView report={report} names={names} />;
}
