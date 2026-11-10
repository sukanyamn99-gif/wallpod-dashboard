import { redirect } from "next/navigation";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getPrimaryBankAccount } from "@/lib/data/bank-accounts";
import { getReceiptVoucherById } from "@/lib/data/receipt-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { paymentDefaultsFromReceipt } from "@/lib/receipt-voucher-defaults";
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

  // A voucher saved before the bank row / ledger existed has them blank. When it
  // still points at its ใบเสร็จรับเงิน, fill them in from that receipt — only shown
  // on the form, nothing is saved until the user presses บันทึก.
  let initialData = voucher;
  let pulledFromReceipt = false;
  const noPaymentInfo = !voucher.bankName && !voucher.bankAccountNo && !voucher.payDate;
  if (voucher.receiptId && (noPaymentInfo || voucher.ledgerLines.length === 0)) {
    const [receipt, bank] = await Promise.all([getBillingDocumentById(voucher.receiptId), getPrimaryBankAccount()]);
    if (receipt && receipt.docType === "receipt") {
      const defaults = paymentDefaultsFromReceipt(receipt, bank, voucher.amount);
      initialData = {
        ...voucher,
        ...(noPaymentInfo
          ? { bankName: defaults.bankName, bankAccountNo: defaults.bankAccountNo, payDate: defaults.payDate }
          : {}),
        ledgerLines: voucher.ledgerLines.length === 0 ? defaults.ledgerLines : voucher.ledgerLines,
      };
      pulledFromReceipt = true;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบสำคัญรับเงิน — {voucher.docNo}</h1>
        {pulledFromReceipt && (
          <p className="text-sm text-muted-foreground">
            ช่องทางรับเงินและรายการบัญชีที่ว่างอยู่ ถูกดึงจากใบเสร็จ {voucher.receiptNo} มาให้ — ตรวจสอบแล้วกดบันทึก
          </p>
        )}
      </div>

      <ReceiptVoucherForm mode="edit" voucherId={voucher.id} docNo={voucher.docNo} initialData={initialData} />
    </div>
  );
}
