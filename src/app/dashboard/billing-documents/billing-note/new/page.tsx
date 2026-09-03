import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomers, getDistinctProjectJobNos, getJobNoLookup, getSalesReps } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentForm } from "../../billing-document-form";

export default async function NewBillingNotePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/billing-note")) redirect("/dashboard/sales");

  const [customers, salesReps, jobNoSuggestions, jobNoLookup] = await Promise.all([
    getCustomers(),
    getSalesReps(),
    getDistinctProjectJobNos(),
    getJobNoLookup(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ออกใบวางบิลใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/billing-documents/billing-note" className="underline underline-offset-2">
            ← กลับไปหน้าใบวางบิล
          </Link>
        </p>
      </div>
      <BillingDocumentForm
        docType="billing_note"
        customers={customers}
        salesReps={salesReps}
        jobNoSuggestions={jobNoSuggestions}
        jobNoLookup={jobNoLookup}
        listPath="/dashboard/billing-documents/billing-note"
      />
    </div>
  );
}
