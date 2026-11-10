import { redirect } from "next/navigation";
import { getBillingDocumentById, getBillingDocuments } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
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
  const [receipts, receipt] = await Promise.all([
    getBillingDocuments("receipt"),
    receiptId ? getBillingDocumentById(receiptId) : Promise.resolve(null),
  ]);
  const source = receipt && receipt.docType === "receipt" ? receipt : null;

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
    // One row for what was actually received (the receipt's net payable); more can be added.
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
        receiptOptions={receipts.map((r) => ({
          id: r.id,
          label: `${r.docNo} — ${r.customerName} (${new Date(r.docDate).toLocaleDateString("th-TH")})`,
        }))}
      />
    </div>
  );
}
