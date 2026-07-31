import { redirect } from "next/navigation";
import { getStockDashboardData } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { LowStockAlertView } from "./low-stock-alert-view";

export default async function LowStockAlertPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/inventory/alerts")) redirect("/dashboard/sales");

  const data = await getStockDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แจ้งเตือนสินค้าใกล้หมด</h1>
        <p className="text-sm text-muted-foreground">สินค้าที่ต่ำกว่าระดับสต๊อกขั้นต่ำ</p>
      </div>

      <LowStockAlertView lowStockItems={data.lowStockItems} currentProfile={profile} />
    </div>
  );
}
