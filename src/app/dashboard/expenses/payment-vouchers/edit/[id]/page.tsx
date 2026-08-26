import { redirect } from "next/navigation";
import { getPaymentVoucherById } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { getDistinctProjectJobNos } from "@/lib/data/reference";
import { canAccessPage } from "@/lib/permissions";
import { PaymentVoucherForm } from "../../payment-voucher-form";

export default async function EditPaymentVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers")) redirect("/dashboard/sales");

  const [voucher, jobNoSuggestions] = await Promise.all([getPaymentVoucherById(id), getDistinctProjectJobNos()]);
  if (!voucher) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">ไม่พบใบสำคัญจ่ายนี้</h1>
      </div>
    );
  }

  const canManage =
    profile.role === "owner" || profile.role === "manager" || profile.role === "account" || voucher.recordedById === profile.id;
  if (!canManage) redirect("/dashboard/expenses/payment-vouchers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบสำคัญจ่าย — {voucher.docNo}</h1>
      </div>

      <PaymentVoucherForm mode="edit" voucherId={voucher.id} initialData={voucher} jobNoSuggestions={jobNoSuggestions} />
    </div>
  );
}
