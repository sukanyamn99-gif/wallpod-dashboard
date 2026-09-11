import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPaymentVoucherById } from "@/lib/data/payment-vouchers";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintWhtCertificateView } from "./print-wht-certificate-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const voucher = await getPaymentVoucherById(id);
  return { title: voucher?.whtCertNo ?? "ใบหัก ณ ที่จ่าย" };
}

export default async function PrintWhtCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/wht-certificates")) redirect("/dashboard/sales");

  const voucher = await getPaymentVoucherById(id);
  if (!voucher) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบสำคัญจ่ายนี้</h1>
      </div>
    );
  }

  return <PrintWhtCertificateView voucher={voucher} />;
}
