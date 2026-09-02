import { redirect } from "next/navigation";
import Link from "next/link";
import { getStockRequisitionById } from "@/lib/data/stock-requisitions";
import { getCustomers, getDepartments, getDistinctProjectJobNos, getJobNoLookup } from "@/lib/data/reference";
import { getFrequentlyUsedStockProducts, getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeRequisitionCosts } from "@/lib/permissions";
import { RequisitionForm } from "../../requisition-form";

// Mirrors requisitions-table.tsx's canDelete rule — owner/manager can edit
// any requisition, anyone else only their own.
function canEdit(role: string, requestedById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return requestedById === profileId;
}

export default async function EditStockRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-requisition")) redirect("/dashboard/sales");

  const { id } = await params;
  const requisition = await getStockRequisitionById(id);
  const allowed = requisition ? canEdit(profile.role, requisition.requestedById, profile.id) : false;

  if (!requisition || !allowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/stock-requisition" className="underline underline-offset-2">
              ← กลับไปหน้าใบเบิกสินค้า
            </Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">ไม่พบใบเบิกนี้ในระบบ หรือคุณไม่มีสิทธิ์แก้ไข</p>
      </div>
    );
  }

  const [departments, jobNoSuggestions, jobNoLookup, customers, stockProducts, frequentlyUsed] = await Promise.all([
    getDepartments(),
    getDistinctProjectJobNos(),
    getJobNoLookup(),
    getCustomers(),
    getStockProducts(),
    getFrequentlyUsedStockProducts(),
  ]);
  const showCosts = canSeeRequisitionCosts(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบเบิกสินค้า {requisition.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/stock-requisition/view/${id}`} className="underline underline-offset-2">
            ← กลับไปหน้าใบเบิกสินค้า
          </Link>
        </p>
      </div>

      <RequisitionForm
        departments={departments}
        jobNoSuggestions={jobNoSuggestions}
        jobNoLookup={jobNoLookup}
        customers={customers}
        stockProducts={stockProducts}
        frequentlyUsed={frequentlyUsed}
        showCosts={showCosts}
        mode="edit"
        requisitionId={id}
        initialData={requisition}
      />
    </div>
  );
}
