import { redirect } from "next/navigation";
import { getStockMovements, getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { MovementsTable } from "./movements-table";

export default async function StockMovementPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-movement")) redirect("/dashboard/sales");

  const [movements, stockProducts] = await Promise.all([getStockMovements(), getStockProducts()]);
  const currentProfile = profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ความเคลื่อนไหวสินค้า</h1>
        <p className="text-sm text-muted-foreground">ประวัติความเคลื่อนไหวสินค้าทั้งหมด</p>
      </div>

      <MovementsTable movements={movements} stockProducts={stockProducts} currentProfile={currentProfile} />
    </div>
  );
}
