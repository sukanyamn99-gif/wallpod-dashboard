import { redirect } from "next/navigation";
import Link from "next/link";
import { getGoodsReceiptById } from "@/lib/data/goods-receipts";
import { getSuppliers } from "@/lib/data/suppliers";
import { getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { GoodsReceiptForm } from "../../goods-receipt-form";
import type { Role } from "@/lib/types";

// Mirrors goods-receipts-table.tsx's canDelete rule: owner/manager can edit
// any receipt, production only its own; support_sale/account never (they
// can create receipts but not edit/delete them).
function canEdit(role: Role, receivedById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return role === "production" && receivedById === profileId;
}

export default async function EditGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/goods-receipt")) redirect("/dashboard/sales");

  const { id } = await params;
  const receipt = await getGoodsReceiptById(id);
  const allowed = receipt ? canEdit(profile.role, receipt.receivedById, profile.id) : false;

  if (!receipt || !allowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/goods-receipt" className="underline underline-offset-2">
              ← กลับไปหน้ารับเข้าสินค้า
            </Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">ไม่พบใบรับสินค้านี้ในระบบ หรือคุณไม่มีสิทธิ์แก้ไข</p>
      </div>
    );
  }

  const [suppliers, stockProducts] = await Promise.all([getSuppliers(), getStockProducts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบรับสินค้า {receipt.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/goods-receipt/view/${id}`} className="underline underline-offset-2">
            ← กลับไปหน้าใบรับสินค้า
          </Link>
        </p>
      </div>

      <GoodsReceiptForm
        suppliers={suppliers}
        stockProducts={stockProducts}
        mode="edit"
        receiptId={id}
        initialData={receipt}
      />
    </div>
  );
}
