import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStockRequisitions } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { RequisitionsTable } from "./requisitions-table";

export default async function StockRequisitionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-requisition")) redirect("/dashboard/sales");

  const requisitions = await getStockRequisitions();
  const currentProfile = profile;
  const canCreate =
    currentProfile.role === "owner" || currentProfile.role === "manager" || currentProfile.role === "production";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบเบิกสินค้า</h1>
          <p className="text-sm text-muted-foreground">คำขอเบิกสินค้าทั้งหมด</p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<a href="/dashboard/stock-requisition/new" />}>
            <Plus className="h-4 w-4" />
            ใบเบิกใหม่
          </Button>
        )}
      </div>

      <RequisitionsTable requisitions={requisitions} currentProfile={currentProfile} />
    </div>
  );
}
