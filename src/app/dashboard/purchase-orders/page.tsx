import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPurchaseOrders } from "@/lib/data/purchase-orders";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { PurchaseOrdersTable } from "./purchase-orders-table";

export default async function PurchaseOrdersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-orders")) redirect("/dashboard/sales");

  const orders = await getPurchaseOrders();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบสั่งซื้อ</h1>
          <p className="text-sm text-muted-foreground">ใบสั่งซื้อทั้งหมด — สร้างจากใบขอซื้อที่อนุมัติแล้ว</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/purchase-orders/new" />}>
          <Plus className="h-4 w-4" />
          ใบสั่งซื้อใหม่
        </Button>
      </div>

      <PurchaseOrdersTable orders={orders} currentProfile={profile} showAmount={canSeeCosts(profile.role)} />
    </div>
  );
}
