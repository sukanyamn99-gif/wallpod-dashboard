import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomers, getSalesReps } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentForm } from "../../billing-document-form";

export default async function NewTaxInvoicePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/tax-invoice")) redirect("/dashboard/sales");

  const [customers, salesReps] = await Promise.all([getCustomers(), getSalesReps()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ออกใบกำกับภาษีใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/billing-documents/tax-invoice" className="underline underline-offset-2">
            ← กลับไปหน้าใบกำกับภาษี
          </Link>
        </p>
      </div>
      <BillingDocumentForm
        docType="tax_invoice"
        customers={customers}
        salesReps={salesReps}
        listPath="/dashboard/billing-documents/tax-invoice"
      />
    </div>
  );
}
