import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { StockProductsTable } from "./stock-products-table";

export default async function StockProductPage() {
  const [products, profile] = await Promise.all([getStockProducts(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null, department: null, active: true };
  const canCreate = currentProfile.role === "owner" || currentProfile.role === "manager";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Stock Product</h1>
          <p className="text-sm text-muted-foreground">รายการสินค้าคงคลังทั้งหมด</p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<a href="/dashboard/stock-product/new" />}>
            <Plus className="h-4 w-4" />
            เพิ่มสินค้า
          </Button>
        )}
      </div>

      <StockProductsTable products={products} currentProfile={currentProfile} />
    </div>
  );
}
