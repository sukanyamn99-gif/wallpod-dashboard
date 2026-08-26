import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getDistinctProjectJobNos } from "@/lib/data/reference";
import { canAccessPage } from "@/lib/permissions";
import { PaymentVoucherForm } from "../payment-voucher-form";

export default async function NewPaymentVoucherPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers")) redirect("/dashboard/sales");
  if (!["owner", "manager", "account"].includes(profile.role)) redirect("/dashboard/expenses/payment-vouchers");

  const jobNoSuggestions = await getDistinctProjectJobNos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สร้างใบสำคัญจ่าย</h1>
        <p className="text-sm text-muted-foreground">บันทึกรายการจ่ายเงินใหม่</p>
      </div>

      <PaymentVoucherForm mode="create" jobNoSuggestions={jobNoSuggestions} />
    </div>
  );
}
