import { redirect } from "next/navigation";
import { getRequisitionReportRows } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { RequisitionReportTable } from "./requisition-report-table";

export default async function RequisitionReportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-requisition/report")) redirect("/dashboard/sales");

  const rows = await getRequisitionReportRows();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รายงานการเบิกสินค้า</h1>
        <p className="text-sm text-muted-foreground">
          ประวัติการเบิกสินค้าทุกรายการ ค้นหาตามเดือนหรือรหัสสินค้าได้
        </p>
      </div>

      <RequisitionReportTable rows={rows} />
    </div>
  );
}
