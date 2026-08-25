import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PaymentVouchersTable } from "./payment-vouchers-table";

export default async function PaymentVouchersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers")) redirect("/dashboard/sales");

  const vouchers = await getPaymentVouchers();
  const canCreate = profile.role === "owner" || profile.role === "manager" || profile.role === "account";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payment Voucher (ใบสำคัญจ่าย)</h1>
          <p className="text-sm text-muted-foreground">รายการใบสำคัญจ่ายทั้งหมด</p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<Link href="/dashboard/expenses/payment-vouchers/new" />}>
            + สร้างใบสำคัญจ่าย
          </Button>
        )}
      </div>

      <PaymentVouchersTable vouchers={vouchers} currentProfile={profile} />
    </div>
  );
}
