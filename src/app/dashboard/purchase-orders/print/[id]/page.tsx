import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPurchaseOrderById } from "@/lib/data/purchase-orders";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPurchaseOrderView } from "./print-purchase-order-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const order = await getPurchaseOrderById(id);
  return { title: order?.docNo ?? "ใบสั่งซื้อ" };
}

export default async function PrintPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-orders")) redirect("/dashboard/sales");

  const order = await getPurchaseOrderById(id);
  if (!order) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบสั่งซื้อนี้</h1>
      </div>
    );
  }

  return <PrintPurchaseOrderView order={order} />;
}
