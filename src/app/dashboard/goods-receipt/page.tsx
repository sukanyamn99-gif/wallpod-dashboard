import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getGoodsReceipts } from "@/lib/data/goods-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { GoodsReceiptsTable } from "./goods-receipts-table";

export default async function GoodsReceiptPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/goods-receipt")) redirect("/dashboard/sales");

  const receipts = await getGoodsReceipts();
  const canCreate = profile.role === "owner" || profile.role === "manager" || profile.role === "production";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">รับเข้าสินค้า</h1>
          <p className="text-sm text-muted-foreground">รายการใบรับสินค้าเข้าสต็อกทั้งหมด</p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<Link href="/dashboard/goods-receipt/new" />}>
            + รับเข้าสินค้าใหม่
          </Button>
        )}
      </div>

      <GoodsReceiptsTable receipts={receipts} currentProfile={profile} />
    </div>
  );
}
