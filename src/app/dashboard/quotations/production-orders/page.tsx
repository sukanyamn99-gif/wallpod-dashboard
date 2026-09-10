import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getAcceptedQuotationsForProduction } from "@/lib/data/quotations";
import { ProductionOrdersTable } from "./production-orders-table";

export default async function ProductionOrdersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations/production-orders")) redirect("/dashboard/sales");

  const orders = await getAcceptedQuotationsForProduction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบลงผลิต</h1>
        <p className="text-sm text-muted-foreground">
          ใบเสนอราคาที่ลูกค้าตอบตกลงแล้ว — กรอกเลขที่ Job และรหัสสินค้าที่นี่แทน (ข้อมูลอื่นในใบเสนอราคายังคงเดิม)
        </p>
      </div>
      <ProductionOrdersTable orders={orders} />
    </div>
  );
}
