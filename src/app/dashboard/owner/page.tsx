import { redirect } from "next/navigation";
import {
  Boxes,
  CircleDollarSign,
  HandCoins,
  Percent,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getOwnerDashboardData } from "@/lib/data/owner-dashboard";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";

export default async function OwnerDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/owner")) redirect("/dashboard/sales");

  const data = await getOwnerDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมสุขภาพธุรกิจ — รวมยอดจากทุกแดชบอร์ดไว้ที่เดียว</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          ยอดขายและกำไรปี {data.year} ({data.yearlyJobCount} งาน — คำนวณต้นทุน/กำไรจาก {data.yearlyCostedJobCount} งานที่มีข้อมูลต้นทุน)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="ยอดขายรวม (Pre-VAT)" value={formatTHB(data.yearlySales)} icon={CircleDollarSign} tone="blue" />
          <KpiCard label="ต้นทุนรวม" value={formatTHB(data.yearlyCost)} icon={Receipt} tone="amber" />
          <KpiCard label="กำไรรวม" value={formatTHB(data.yearlyProfit)} icon={TrendingUp} tone="green" />
          <KpiCard label="อัตรากำไร" value={`${data.yearlyMarginPercent.toFixed(1)}%`} icon={Percent} tone="violet" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">สถานะการเงิน ณ วันนี้</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="ลูกหนี้คงค้างรวม" value={formatTHB(data.receivablesTotal)} icon={Users} tone="violet" />
          <KpiCard label="เจ้าหนี้คงค้างรวม" value={formatTHB(data.payablesTotal)} icon={HandCoins} tone="rose" />
          <KpiCard label="มูลค่าสต๊อกคงเหลือ" value={formatTHB(data.stockValue)} icon={Boxes} tone="blue" />
        </div>
      </div>
    </div>
  );
}
