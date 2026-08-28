import { redirect } from "next/navigation";
import { AlertTriangle, Briefcase, CircleDollarSign, Store } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PayablesBySupplierChart } from "@/components/dashboard/payables-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayablesDashboardData } from "@/lib/data/payables";
import { getSuppliers } from "@/lib/data/suppliers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import { PayablesTable } from "./payables-table";

export default async function PayablesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payables")) redirect("/dashboard/sales");

  const [data, suppliers] = await Promise.all([getPayablesDashboardData(), getSuppliers()]);
  const canManage = profile.role === "owner" || profile.role === "manager" || profile.role === "account";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">เจ้าหนี้คงค้าง</h1>
          <p className="text-sm text-muted-foreground">
            ยอดค่าสินค้าที่ยังไม่ได้จ่ายให้ผู้จำหน่าย — นับจากใบรับสินค้าที่สถานะ &quot;ยังไม่จ่าย&quot;
          </p>
        </div>
        {canManage && <OpeningBalanceDialog suppliers={suppliers} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="เจ้าหนี้คงค้างรวม" value={formatTHB(data.kpis.totalOutstanding)} icon={CircleDollarSign} tone="blue" />
        <KpiCard label="ใบรับสินค้าที่ยังไม่จ่าย" value={`${data.kpis.unpaidCount} ใบ`} icon={Briefcase} tone="amber" />
        <KpiCard label="จำนวนผู้จำหน่ายที่ค้างจ่าย" value={`${data.kpis.supplierCount} เจ้า`} icon={Store} tone="violet" />
        <KpiCard label="ค้างจ่ายนานที่สุด" value={`${data.kpis.oldestAgeDays} วัน`} icon={AlertTriangle} tone="rose" />
      </div>

      <PayablesBySupplierChart data={data.bySupplier} list={data.list} />

      <Card>
        <CardHeader>
          <CardTitle>รายการเจ้าหนี้คงค้าง (เรียงจากค้างนานสุด)</CardTitle>
        </CardHeader>
        <CardContent>
          <PayablesTable rows={data.list} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
