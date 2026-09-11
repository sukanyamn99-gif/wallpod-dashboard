import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPurchaseRequests } from "@/lib/data/purchase-requests";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseRequestsTable } from "./purchase-requests-table";

export default async function PurchaseRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-requests")) redirect("/dashboard/sales");

  const requests = await getPurchaseRequests();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบขอซื้อ</h1>
          <p className="text-sm text-muted-foreground">คำขอซื้อสินค้าทั้งหมด — ต้องได้รับอนุมัติก่อนจึงออกใบสั่งซื้อได้</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/purchase-requests/new" />}>
          <Plus className="h-4 w-4" />
          ใบขอซื้อใหม่
        </Button>
      </div>

      <PurchaseRequestsTable requests={requests} currentProfile={profile} />
    </div>
  );
}
