import { redirect } from "next/navigation";
import Link from "next/link";
import { getPurchaseOrderReceiptById } from "@/lib/data/purchase-order-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseOrderReceiptEditForm } from "./purchase-order-receipt-edit-form";

// Mirrors this table's own RLS (purchase_order_receipts_update): owner/
// manager can edit any receipt, anyone else only their own.
function canEdit(role: string, receivedById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return receivedById === profileId;
}

export default async function EditPurchaseOrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-order-receipts")) redirect("/dashboard/sales");

  const receipt = await getPurchaseOrderReceiptById(id);
  if (!receipt) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">ไม่พบใบรับสินค้านี้</h1>
      </div>
    );
  }

  if (!canEdit(profile.role, receipt.receivedById, profile.id)) redirect("/dashboard/purchase-order-receipts");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบรับสินค้า — {receipt.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/purchase-order-receipts" className="underline underline-offset-2">
            ← กลับไปหน้าใบรับสินค้า
          </Link>
        </p>
      </div>

      <PurchaseOrderReceiptEditForm receipt={receipt} />
    </div>
  );
}
