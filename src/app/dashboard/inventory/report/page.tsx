import { redirect } from "next/navigation";
import { getStockDashboardData, getStockMovements } from "@/lib/data/stock";
import { getStockRequisitionItemsForReport } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { InventoryReportView } from "./inventory-report-view";

export default async function InventoryReportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/inventory/report")) redirect("/dashboard/sales");

  const [dashboardData, movements, requisitionItems] = await Promise.all([
    getStockDashboardData(),
    getStockMovements(),
    getStockRequisitionItemsForReport(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รายงาน</h1>
        <p className="text-sm text-muted-foreground">การวิเคราะห์และสรุปข้อมูลสต๊อกสินค้า</p>
      </div>

      <InventoryReportView
        dashboardData={dashboardData}
        movements={movements}
        requisitionItems={requisitionItems}
        canSeeCosts={canSeeCosts(profile.role)}
      />
    </div>
  );
}
