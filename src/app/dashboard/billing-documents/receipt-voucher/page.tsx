import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getReceiptVouchers } from "@/lib/data/receipt-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { ReceiptVouchersTable } from "./receipt-vouchers-table";

export default async function ReceiptVouchersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt-voucher")) redirect("/dashboard/sales");

  const vouchers = await getReceiptVouchers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบสำคัญรับเงิน</h1>
          <p className="text-sm text-muted-foreground">ออกจากใบเสร็จรับเงินที่บริษัทได้รับเงินแล้ว</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/billing-documents/receipt-voucher/new" />}>
          + สร้างใบสำคัญรับเงิน
        </Button>
      </div>

      <ReceiptVouchersTable vouchers={vouchers} />
    </div>
  );
}
