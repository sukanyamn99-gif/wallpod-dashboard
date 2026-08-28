import { PackageSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getSignedStockProductImageUrls, getStockProductLotsByProduct, getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canCreateStockProduct, canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { StockProductsTable } from "./stock-products-table";

export default async function StockProductPage() {
  const [products, profile] = await Promise.all([getStockProducts(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null, department: null, active: true };
  const canCreate = canCreateStockProduct(currentProfile.role);
  const showCosts = canSeeCosts(currentProfile.role);
  const totalStockValue = products.reduce((sum, p) => sum + p.quantityOnHand * p.unitCost, 0);

  const imagePaths = products.map((p) => p.imagePath).filter((p): p is string => p !== null);
  const [imageUrls, lotsByProduct] = await Promise.all([
    getSignedStockProductImageUrls(imagePaths),
    getStockProductLotsByProduct(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
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

      {showCosts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="มูลค่าสต๊อกรวม" value={formatTHB(totalStockValue)} icon={PackageSearch} tone="green" />
        </div>
      )}

      <StockProductsTable
        products={products}
        currentProfile={currentProfile}
        imageUrls={imageUrls}
        lotsByProduct={lotsByProduct}
      />
    </div>
  );
}
