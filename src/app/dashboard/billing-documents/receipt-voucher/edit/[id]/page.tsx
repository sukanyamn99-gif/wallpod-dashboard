import { redirect } from "next/navigation";
import { getReceiptVoucherById } from "@/lib/data/receipt-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { ReceiptVoucherForm } from "../../receipt-voucher-form";

export default async function EditReceiptVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt-voucher")) redirect("/dashboard/sales");

  const voucher = await getReceiptVoucherById(id);
  if (!voucher) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">ไม่พบใบสำคัญรับเงินนี้</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบสำคัญรับเงิน — {voucher.docNo}</h1>
      </div>

      <ReceiptVoucherForm mode="edit" voucherId={voucher.id} docNo={voucher.docNo} initialData={voucher} />
    </div>
  );
}
