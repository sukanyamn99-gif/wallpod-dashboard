import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPurchaseRequestById } from "@/lib/data/purchase-requests";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { PrintPurchaseRequestView } from "./print-purchase-request-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const request = await getPurchaseRequestById(id);
  return { title: request?.docNo ?? "ใบขอซื้อ" };
}

export default async function PrintPurchaseRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-requests")) redirect("/dashboard/sales");

  const request = await getPurchaseRequestById(id);
  if (!request) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบขอซื้อนี้</h1>
      </div>
    );
  }

  return <PrintPurchaseRequestView request={request} showCosts={canSeeCosts(profile.role)} />;
}
