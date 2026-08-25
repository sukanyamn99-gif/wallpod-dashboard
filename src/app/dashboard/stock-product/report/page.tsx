import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getProductCategories } from "@/lib/data/reference";
import { getStockProducts, getSignedStockProductImageUrls } from "@/lib/data/stock";
import { canAccessPage } from "@/lib/permissions";
import { StockCatalogReport } from "./stock-catalog-report";

export default async function StockCatalogReportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-product/report")) redirect("/dashboard/sales");

  const [products, categories] = await Promise.all([getStockProducts(), getProductCategories()]);
  const imagePaths = products.map((p) => p.imagePath).filter((p): p is string => !!p);
  const imageUrls = await getSignedStockProductImageUrls(imagePaths);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">รายงานสินค้าคงเหลือ</h1>
        <p className="text-sm text-muted-foreground">แสดงสี ชื่อสินค้า และจำนวนคงเหลือของสินค้าทั้งหมด</p>
      </div>

      <StockCatalogReport
        products={products}
        imageUrls={imageUrls}
        categories={categories.map((c) => c.name)}
      />
    </div>
  );
}
