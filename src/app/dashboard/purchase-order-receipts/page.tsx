import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPurchaseOrderReceipts } from "@/lib/data/purchase-order-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseOrderReceiptsTable } from "./purchase-order-receipts-table";

export default async function PurchaseOrderReceiptsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-order-receipts")) redirect("/dashboard/sales");

  const receipts = await getPurchaseOrderReceipts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบรับสินค้า</h1>
          <p className="text-sm text-muted-foreground">การรับสินค้าเข้าสต็อกตามใบสั่งซื้อทั้งหมด</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/purchase-order-receipts/new" />}>
          <Plus className="h-4 w-4" />
          รับสินค้าใหม่
        </Button>
      </div>

      <PurchaseOrderReceiptsTable receipts={receipts} currentProfile={profile} />
    </div>
  );
}
