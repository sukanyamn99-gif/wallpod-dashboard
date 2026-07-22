import { getStockMovements, getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { MovementsTable } from "./movements-table";

export default async function StockMovementPage() {
  const [movements, stockProducts, profile] = await Promise.all([
    getStockMovements(),
    getStockProducts(),
    getCurrentProfile(),
  ]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null };

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
