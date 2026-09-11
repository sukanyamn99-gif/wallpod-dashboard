import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getApprovedPurchaseRequests } from "@/lib/data/purchase-requests";
import { getSuppliers } from "@/lib/data/suppliers";
import { getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseOrderForm } from "../purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-orders")) redirect("/dashboard/sales");

  const [approvedRequests, suppliers, stockProducts] = await Promise.all([
    getApprovedPurchaseRequests(),
    getSuppliers(),
    getStockProducts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบสั่งซื้อใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/purchase-orders" className="underline underline-offset-2">
            ← กลับไปหน้าใบสั่งซื้อ
          </Link>
        </p>
      </div>

      {/* useSearchParams (reading ?requestId=) needs a Suspense boundary */}
      <Suspense>
        <PurchaseOrderForm approvedRequests={approvedRequests} suppliers={suppliers} stockProducts={stockProducts} />
      </Suspense>
    </div>
  );
}
