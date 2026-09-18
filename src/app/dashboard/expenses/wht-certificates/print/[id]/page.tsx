import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWhtCertificateById } from "@/lib/data/wht-certificates";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import type { WhtCertificateSource } from "@/lib/types";
import { PrintWhtCertificateView } from "./print-wht-certificate-view";

function parseSource(value: string | undefined): WhtCertificateSource {
  return value === "petty_cash" ? "petty_cash" : "payment_voucher";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { source } = await searchParams;
  const certificate = await getWhtCertificateById(id, parseSource(source));
  return { title: certificate?.whtCertNo ?? "ใบหัก ณ ที่จ่าย" };
}

export default async function PrintWhtCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const { source } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/wht-certificates")) redirect("/dashboard/sales");

  const certificate = await getWhtCertificateById(id, parseSource(source));
  if (!certificate) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบรายการนี้</h1>
      </div>
    );
  }

  return <PrintWhtCertificateView certificate={certificate} />;
}
