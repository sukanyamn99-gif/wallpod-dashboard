import { redirect } from "next/navigation";
import { getStockRequisitionById } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeRequisitionCosts } from "@/lib/permissions";
import { PrintRequisitionView } from "./print-requisition-view";

export default async function PrintStockRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/stock-requisition")) redirect("/dashboard/sales");

  const requisition = await getStockRequisitionById(id);
  if (!requisition) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบเบิกสินค้านี้</h1>
      </div>
    );
  }

  return <PrintRequisitionView requisition={requisition} showCosts={canSeeRequisitionCosts(profile.role)} />;
}
