import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getCommissionForReport } from "@/lib/data/commission";
import { PrintReportView } from "./print-report-view";

export default async function PrintCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ brokers?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const { brokers: brokersParam, dateFrom, dateTo } = await searchParams;

  // Selecting a date range/broker(s) now happens on the main commission
  // page (ReportSelector) rather than as a step on this page — land back
  // there if this page is reached without a real selection.
  if (!brokersParam || !dateFrom || !dateTo) redirect("/dashboard/expenses/commission");

  const brokers = brokersParam.split(",").filter(Boolean);
  const projects = await getCommissionForReport(dateFrom, dateTo);

  return <PrintReportView brokers={brokers} windowStart={dateFrom} windowEnd={dateTo} projects={projects} />;
}
