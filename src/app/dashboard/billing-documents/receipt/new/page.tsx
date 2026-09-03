import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomers, getDistinctProjectJobNos, getJobNoLookup, getSalesReps } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentForm } from "../../billing-document-form";

export default async function NewReceiptPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt")) redirect("/dashboard/sales");

  const [customers, salesReps, jobNoSuggestions, jobNoLookup] = await Promise.all([
    getCustomers(),
    getSalesReps(),
    getDistinctProjectJobNos(),
    getJobNoLookup(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ออกใบเสร็จรับเงินใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/billing-documents/receipt" className="underline underline-offset-2">
            ← กลับไปหน้าใบเสร็จรับเงิน
          </Link>
        </p>
      </div>
      <BillingDocumentForm
        docType="receipt"
        customers={customers}
        salesReps={salesReps}
        jobNoSuggestions={jobNoSuggestions}
        jobNoLookup={jobNoLookup}
        listPath="/dashboard/billing-documents/receipt"
      />
    </div>
  );
}
