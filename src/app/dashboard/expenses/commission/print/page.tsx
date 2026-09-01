import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getCommissionForReport, getCommissionableProjects } from "@/lib/data/commission";
import { PrintCommissionView } from "./print-commission-view";
import { PrintSelector } from "./print-selector";

export default async function PrintCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ broker?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const { broker, dateFrom, dateTo } = await searchParams;

  if (!broker || !dateFrom || !dateTo) {
    const projects = await getCommissionableProjects();
    const salesRepNames = Array.from(new Set(projects.map((p) => p.salesRepName))).sort();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">พิมพ์รายงานค่าคอมมิชชั่น</h1>
          <p className="text-sm text-muted-foreground">เลือกพนักงานขาย และช่วงวันที่</p>
        </div>
        <PrintSelector salesRepNames={salesRepNames} />
      </div>
    );
  }

  const projects = await getCommissionForReport(dateFrom, dateTo);

  return <PrintCommissionView broker={broker} windowStart={dateFrom} windowEnd={dateTo} projects={projects} />;
}
