import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getDistinctProjectJobNos } from "@/lib/data/reference";
import { getPaymentVoucherById } from "@/lib/data/payment-vouchers";
import { canAccessPage } from "@/lib/permissions";
import { PaymentVoucherForm } from "../payment-voucher-form";

export default async function NewPaymentVoucherPage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers")) redirect("/dashboard/sales");
  if (!["owner", "manager", "account"].includes(profile.role)) redirect("/dashboard/expenses/payment-vouchers");

  const { copyFrom } = await searchParams;
  const [jobNoSuggestions, sourceVoucher] = await Promise.all([
    getDistinctProjectJobNos(),
    copyFrom ? getPaymentVoucherById(copyFrom) : Promise.resolve(null),
  ]);

  // Copying an old voucher as a starting point for a new payment — doc_no
  // is always freshly generated on save regardless (the form's create mode
  // never reads initialData.docNo). voucher_date/bank_transfer_date must
  // NOT carry over: this is a brand-new, not-yet-paid document, and
  // keeping the old transfer date would wrongly mark it as already
  // transferred (see getVoucherOutflows' bank_transfer_date handling).
  // wht_cert_no is also cleared — it's a formal tax certificate reference
  // meant to be unique per voucher, not shared across two documents.
  const initialData = sourceVoucher
    ? {
        ...sourceVoucher,
        voucherDate: new Date().toISOString().slice(0, 10),
        bankTransferDate: null,
        whtCertNo: null,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{sourceVoucher ? `คัดลอกจาก ${sourceVoucher.docNo}` : "สร้างใบสำคัญจ่าย"}</h1>
        <p className="text-sm text-muted-foreground">
          {sourceVoucher ? "ตรวจสอบและแก้ไขข้อมูลก่อนบันทึกเป็นใบสำคัญจ่ายใหม่" : "บันทึกรายการจ่ายเงินใหม่"}
        </p>
      </div>

      <PaymentVoucherForm mode="create" jobNoSuggestions={jobNoSuggestions} initialData={initialData} />
    </div>
  );
}
