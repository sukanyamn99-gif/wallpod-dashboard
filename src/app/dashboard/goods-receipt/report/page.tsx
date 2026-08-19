import { redirect } from "next/navigation";
import { getReceiptReportRows } from "@/lib/data/goods-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { ReceiptReportTable } from "./receipt-report-table";

export default async function ReceiptReportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/goods-receipt/report")) redirect("/dashboard/sales");

  const rows = await getReceiptReportRows();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รายงานการรับเข้าสินค้า</h1>
        <p className="text-sm text-muted-foreground">
          ประวัติการรับสินค้าเข้าทุกรายการ ค้นหาตามเดือนหรือรหัสสินค้าได้
        </p>
      </div>

      <ReceiptReportTable rows={rows} canSeeCosts={canSeeCosts(profile.role)} />
    </div>
  );
}
