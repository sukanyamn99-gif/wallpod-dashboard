import Link from "next/link";
import { getDepartments } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { DepartmentsTable } from "./departments-table";

export default async function DepartmentsPage() {
  const [departments, profile] = await Promise.all([getDepartments(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null };
  const canManage = currentProfile.role === "owner" || currentProfile.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">จัดการแผนก</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/stock-requisition/new" className="underline underline-offset-2">
            ← กลับไปหน้าใบเบิกสินค้าใหม่
          </Link>
        </p>
      </div>

      <DepartmentsTable departments={departments} canManage={canManage} />
    </div>
  );
}
