import { redirect } from "next/navigation";
import Link from "next/link";
import { getSuppliers } from "@/lib/data/suppliers";
import { getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { GoodsReceiptForm } from "../goods-receipt-form";

export default async function NewGoodsReceiptPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/goods-receipt")) redirect("/dashboard/sales");

  const [suppliers, stockProducts] = await Promise.all([getSuppliers(), getStockProducts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รับเข้าสินค้าใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/goods-receipt" className="underline underline-offset-2">
            ← กลับไปหน้ารับเข้าสินค้า
          </Link>
        </p>
      </div>

      <GoodsReceiptForm suppliers={suppliers} stockProducts={stockProducts} />
    </div>
  );
}
