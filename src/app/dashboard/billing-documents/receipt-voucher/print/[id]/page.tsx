import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getReceiptVoucherById } from "@/lib/data/receipt-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintReceiptVoucherView } from "./print-receipt-voucher-view";

// See quotations/print/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const voucher = await getReceiptVoucherById(id);
  return { title: voucher?.docNo ?? "ใบสำคัญรับเงิน" };
}

export default async function PrintReceiptVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt-voucher")) redirect("/dashboard/sales");

  const voucher = await getReceiptVoucherById(id);
  if (!voucher) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบสำคัญรับเงินนี้</h1>
      </div>
    );
  }

  return <PrintReceiptVoucherView voucher={voucher} />;
}
