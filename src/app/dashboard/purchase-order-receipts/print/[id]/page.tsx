import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPurchaseOrderReceiptById } from "@/lib/data/purchase-order-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPurchaseOrderReceiptView } from "./print-purchase-order-receipt-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const receipt = await getPurchaseOrderReceiptById(id);
  return { title: receipt?.docNo ?? "ใบรับสินค้า" };
}

export default async function PrintPurchaseOrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-order-receipts")) redirect("/dashboard/sales");

  const receipt = await getPurchaseOrderReceiptById(id);
  if (!receipt) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบรับสินค้านี้</h1>
      </div>
    );
  }

  return <PrintPurchaseOrderReceiptView receipt={receipt} />;
}
