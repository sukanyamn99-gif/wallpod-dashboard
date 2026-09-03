import { redirect } from "next/navigation";
import { getCustomers } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { CustomersTable } from "./customers-table";

export default async function CustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/customers")) redirect("/dashboard/sales");

  const customers = await getCustomers();
  const canManage = profile.role === "owner" || profile.role === "manager" || profile.role === "support_sale";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ลูกค้า</h1>
        <p className="text-sm text-muted-foreground">รายชื่อลูกค้าทั้งหมดในระบบ</p>
      </div>

      <CustomersTable customers={customers} canManage={canManage} />
    </div>
  );
}
