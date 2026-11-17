import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getVouchersByReceipt } from "@/lib/data/receipt-vouchers";
import { getBillingDocumentById, getBillingDocuments } from "@/lib/data/billing-documents";
import { getPrimaryBankAccount } from "@/lib/data/bank-accounts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { paymentDefaultsFromReceipt } from "@/lib/receipt-voucher-defaults";
import { ReceiptVoucherForm, type ReceiptVoucherDraft } from "../receipt-voucher-form";

export default async function NewReceiptVoucherPage({
  searchParams,
}: {
  searchParams: Promise<{ receiptId?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt-voucher")) redirect("/dashboard/sales");

  const { receiptId } = await searchParams;
  const [receipts, receipt, bank] = await Promise.all([
    getBillingDocuments("receipt"),
    receiptId ? getBillingDocumentById(receiptId) : Promise.resolve(null),
    getPrimaryBankAccount(),
  ]);
  const source = receipt && receipt.docType === "receipt" ? receipt : null;

  // One ใบสำคัญรับเงิน per ใบเสร็จ — a receipt that already has one can't be used again.
  const vouchersByReceipt = await getVouchersByReceipt(receipts);
  const existingVoucher = source ? vouchersByReceipt[source.id] : undefined;
  if (source && existingVoucher) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">ออกใบสำคัญรับเงินแล้ว</h1>
        <p className="text-sm text-muted-foreground">
          ใบเสร็จรับเงิน {source.docNo} ออกใบสำคัญรับเงินเลขที่ {existingVoucher.docNo} ไปแล้ว — ออกซ้ำไม่ได้
        </p>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/dashboard/billing-documents/receipt-voucher/edit/${existingVoucher.id}`} />}>
            เปิดใบสำคัญรับเงิน {existingVoucher.docNo}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/billing-documents/receipt" />}>
            กลับไปรายการใบเสร็จ
          </Button>
        </div>
      </div>
    );
  }

  const refNos = source
    ? Array.from(
        new Set(
          source.items
            .filter((it) => !it.manualDescription)
            .map((it) => it.taxInvoiceDocNo ?? it.invoiceNo)
            .filter(Boolean),
        ),
      )
    : [];

  const draft: ReceiptVoucherDraft = {
    docDate: new Date().toISOString().slice(0, 10),
    receiptId: source?.id ?? null,
    receiptNo: source?.docNo ?? null,
    contactName: source?.customerName ?? "",
    contactTaxId: source?.customerTaxId ?? null,
    contactAddress: source?.customerAddress ?? null,
    note: null,
    ...(source
      ? paymentDefaultsFromReceipt(source, bank, source.amount)
      : { bankName: null, bankAccountNo: null, payDate: null, ledgerLines: [] }),
    items: source
      ? [
          {
            description: `รับชำระเงิน #${source.docNo} จาก ${source.customerName}${refNos.length > 0 ? ` Ref: ${refNos.map((n) => `#${n}`).join(" ")}` : ""}`,
            amount: source.amount,
          },
        ]
      : [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สร้างใบสำคัญรับเงิน</h1>
        <p className="text-sm text-muted-foreground">ออกใบสำคัญรับเงินจากใบเสร็จรับเงิน — ตรวจสอบข้อมูลก่อนบันทึก</p>
      </div>

      <ReceiptVoucherForm
        // Remount when another receipt is picked so the uncontrolled fields take the new defaults.
        key={source?.id ?? "blank"}
        mode="create"
        initialData={draft}
        receiptOptions={receipts.filter((r) => !vouchersByReceipt[r.id]).map((r) => ({
          id: r.id,
          docNo: r.docNo,
          label: `${r.docNo} — ${r.customerName} (${new Date(r.docDate).toLocaleDateString("th-TH")})`,
        }))}
      />
    </div>
  );
}
