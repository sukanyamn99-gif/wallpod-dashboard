import { redirect } from "next/navigation";
import { getPaymentVoucherById } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintVoucherView } from "./print-voucher-view";

export default async function PrintPaymentVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers")) redirect("/dashboard/sales");

  const voucher = await getPaymentVoucherById(id);
  if (!voucher) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบสำคัญจ่ายนี้</h1>
      </div>
    );
  }

  return <PrintVoucherView voucher={voucher} />;
}
