import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOpenPurchaseOrders } from "@/lib/data/purchase-orders";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseOrderReceiptForm } from "../purchase-order-receipt-form";

export default async function NewPurchaseOrderReceiptPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-order-receipts")) redirect("/dashboard/sales");

  const openOrders = await getOpenPurchaseOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รับสินค้าใหม่ (ตามใบสั่งซื้อ)</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/purchase-order-receipts" className="underline underline-offset-2">
            ← กลับไปหน้าใบรับสินค้า
          </Link>
        </p>
      </div>

      <Suspense>
        <PurchaseOrderReceiptForm openOrders={openOrders} />
      </Suspense>
    </div>
  );
}
