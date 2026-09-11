import { redirect } from "next/navigation";
import { getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { WhtCertificatesTable } from "./wht-certificates-table";

export default async function WhtCertificatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/wht-certificates")) redirect("/dashboard/sales");

  const vouchers = await getPaymentVouchers();
  // A ใบหัก ณ ที่จ่าย only exists where a voucher actually withheld tax —
  // this menu is a filtered view over Payment Voucher, not a separate
  // record; edit the underlying voucher to fix any field shown here.
  const withheld = vouchers.filter((v) => v.whtAmount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบหัก ณ ที่จ่าย</h1>
        <p className="text-sm text-muted-foreground">
          รายการใบสำคัญจ่ายที่มีการหักภาษี ณ ที่จ่าย — แก้ไขข้อมูลได้ที่หน้า Payment Voucher
        </p>
      </div>

      <WhtCertificatesTable vouchers={withheld} />
    </div>
  );
}
