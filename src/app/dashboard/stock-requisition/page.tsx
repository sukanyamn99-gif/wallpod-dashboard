import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStockRequisitions } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { RequisitionsTable } from "./requisitions-table";

export default async function StockRequisitionPage() {
  const [requisitions, profile] = await Promise.all([getStockRequisitions(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null, department: null, active: true };
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
