import Link from "next/link";
import { getCustomers, getDepartments, getDistinctProjectJobNos, getJobNoLookup } from "@/lib/data/reference";
import { getFrequentlyUsedStockProducts, getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canSeeRequisitionCosts } from "@/lib/permissions";
import { RequisitionForm } from "../requisition-form";

export default async function NewStockRequisitionPage() {
  const [departments, jobNoSuggestions, jobNoLookup, customers, stockProducts, frequentlyUsed, profile] =
    await Promise.all([
      getDepartments(),
      getDistinctProjectJobNos(),
      getJobNoLookup(),
      getCustomers(),
      getStockProducts(),
      getFrequentlyUsedStockProducts(),
      getCurrentProfile(),
    ]);
  const showCosts = canSeeRequisitionCosts(profile?.role ?? "sales");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบเบิกสินค้าใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/stock-requisition" className="underline underline-offset-2">
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
      />
    </div>
  );
}
