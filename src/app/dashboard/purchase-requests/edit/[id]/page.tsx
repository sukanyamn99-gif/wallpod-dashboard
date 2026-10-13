import { redirect } from "next/navigation";
import Link from "next/link";
import { getDepartments, getDistinctProjectJobNos, getJobNoLookup } from "@/lib/data/reference";
import { getStockProducts } from "@/lib/data/stock";
import { getSuppliers } from "@/lib/data/suppliers";
import { getCurrentProfile } from "@/lib/data/profile";
import { getPurchaseRequestById } from "@/lib/data/purchase-requests";
import { canAccessPage } from "@/lib/permissions";
import { canEditPurchaseRequest } from "@/lib/purchase-request-edit";
import { PurchaseRequestForm } from "../../purchase-request-form";

export default async function EditPurchaseRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-requests")) redirect("/dashboard/sales");

  const request = await getPurchaseRequestById(id);
  const backHref = request ? `/dashboard/purchase-requests/view/${id}` : "/dashboard/purchase-requests";

  let blockedReason: string | null = null;
  if (!request) blockedReason = "ไม่พบใบขอซื้อนี้ในระบบ";
  else if (request.hasPurchaseOrder) blockedReason = "แก้ไขไม่ได้ — ได้ออกใบสั่งซื้อจากใบขอซื้อนี้ไปแล้ว";
  else if (!canEditPurchaseRequest(profile, request)) blockedReason = "ไม่มีสิทธิ์แก้ไขใบขอซื้อนี้";

  const [departments, stockProducts, suppliers, jobNoSuggestions, jobNoLookup] = blockedReason
    ? [[], [], [], [], {}]
    : await Promise.all([
        getDepartments(),
        getStockProducts(),
        getSuppliers(),
        getDistinctProjectJobNos(),
        getJobNoLookup(),
      ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{request ? `แก้ไขใบขอซื้อ ${request.docNo}` : "ไม่พบข้อมูล"}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={backHref} className="underline underline-offset-2">
            ← กลับ
          </Link>
        </p>
      </div>

      {blockedReason || !request ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{blockedReason}</p>
      ) : (
        <PurchaseRequestForm
          mode="edit"
          requestId={id}
          initialData={request}
          departments={departments}
          stockProducts={stockProducts}
          suppliers={suppliers}
          jobNoSuggestions={jobNoSuggestions}
          jobNoLookup={jobNoLookup}
        />
      )}
    </div>
  );
}
