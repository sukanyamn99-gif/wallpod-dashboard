import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPaymentVoucherSummaryView } from "./print-payment-voucher-summary-view";

type SummarySearchParams = { docFrom?: string; docTo?: string; dateFrom?: string; dateTo?: string };

// See petty-cash/print/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SummarySearchParams>;
}): Promise<Metadata> {
  const { docFrom, docTo, dateFrom, dateTo } = await searchParams;
  const label =
    docFrom || docTo
      ? `${docFrom ?? "เริ่มต้น"}-${docTo ?? "ล่าสุด"}`
      : `${dateFrom ? new Date(dateFrom).toLocaleDateString("th-TH") : "เริ่มต้น"}-${
          dateTo ? new Date(dateTo).toLocaleDateString("th-TH") : "ปัจจุบัน"
        }`;
  return { title: `รายการจ่าย ${label}` };
}

export default async function PaymentVoucherSummaryPage({
  searchParams,
}: {
  searchParams: Promise<SummarySearchParams>;
}) {
  const { docFrom, docTo, dateFrom, dateTo } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payment-vouchers/summary")) redirect("/dashboard/sales");

  const all = await getPaymentVouchers();
  // doc_no (PVyymmnnn) sorts lexicographically the same as chronologically,
  // same convention already relied on elsewhere in this app's doc-no logic
  // — so a plain string comparison correctly implements "PV ไหน–PV ไหน".
  const rows = all
    .filter((v) => {
      if (docFrom && v.docNo < docFrom) return false;
      if (docTo && v.docNo > docTo) return false;
      if (dateFrom && v.voucherDate < dateFrom) return false;
      if (dateTo && v.voucherDate > dateTo) return false;
      return true;
    })
    .sort((a, b) => a.docNo.localeCompare(b.docNo));

  const fromLabel = docFrom || (dateFrom ? new Date(dateFrom).toLocaleDateString("th-TH") : "เริ่มต้น");
  const toLabel = docTo || (dateTo ? new Date(dateTo).toLocaleDateString("th-TH") : "ปัจจุบัน");

  return <PrintPaymentVoucherSummaryView rows={rows} fromLabel={fromLabel} toLabel={toLabel} preparerName={profile.full_name} />;
}
