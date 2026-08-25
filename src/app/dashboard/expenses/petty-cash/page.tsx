import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { getPettyCashTransactions } from "@/lib/data/petty-cash";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { PettyCashTable } from "./petty-cash-table";

export default async function PettyCashPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");

  const transactions = await getPettyCashTransactions();
  const currentBalance = transactions[0]?.balanceAfter ?? 0;
  const canCreate = profile.role === "owner" || profile.role === "manager" || profile.role === "account";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">เงินสดย่อย</h1>
          <p className="text-sm text-muted-foreground">
            บันทึกการเติมเงิน/ใช้จ่ายเงินสดย่อย — เป็นบัญชีแบบต่อเนื่อง ไม่สามารถแก้ไข/ลบรายการย้อนหลังได้
            หากบันทึกผิดให้บันทึกรายการแก้ไขเพิ่ม
          </p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<Link href="/dashboard/expenses/petty-cash/new" />}>
            + บันทึกรายการ
          </Button>
        )}
      </div>

      <div className="max-w-xs">
        <KpiCard label="ยอดเงินสดย่อยคงเหลือ" value={formatTHB(currentBalance)} icon={Wallet} tone="green" />
      </div>

      <PettyCashTable transactions={transactions} />
    </div>
  );
}
