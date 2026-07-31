import Link from "next/link";
import { getSuppliers } from "@/lib/data/suppliers";
import { getCurrentProfile } from "@/lib/data/profile";
import { SuppliersTable } from "./suppliers-table";

export default async function SuppliersPage() {
  const [suppliers, profile] = await Promise.all([getSuppliers(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null, department: null, active: true };
  const canManage = currentProfile.role === "owner" || currentProfile.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">จัดการผู้จำหน่าย</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/goods-receipt/new" className="underline underline-offset-2">
            ← กลับไปหน้ารับเข้าสินค้าใหม่
          </Link>
        </p>
      </div>

      <SuppliersTable suppliers={suppliers} canManage={canManage} />
    </div>
  );
}
