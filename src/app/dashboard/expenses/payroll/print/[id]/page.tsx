import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getPayrollEntryById, getPayrollYtdSummary } from "@/lib/data/payroll";
import { PrintPayrollView } from "./print-payroll-view";

// See quotations/print/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const entry = await getPayrollEntryById(id);
  return { title: entry ? `เงินเดือน ${entry.employeeName} ${entry.payPeriod}` : "สลิปเงินเดือน" };
}

export default async function PrintPayrollEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payroll")) redirect("/dashboard/sales");

  const entry = await getPayrollEntryById(id);
  if (!entry) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบรายการเงินเดือนนี้</h1>
      </div>
    );
  }

  const ytd = await getPayrollYtdSummary(entry.employeeId, entry.payPeriod);

  return <PrintPayrollView entry={entry} ytd={ytd} />;
}
