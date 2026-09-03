import { redirect } from "next/navigation";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintBillingDocumentView } from "../../../print-billing-document-view";

export default async function ViewTaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/tax-invoice")) redirect("/dashboard/sales");

  const { id } = await params;
  const document = await getBillingDocumentById(id);

  if (!document || document.docType !== "tax_invoice") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบกำกับภาษีนี้</h1>
      </div>
    );
  }

  return <PrintBillingDocumentView document={document} />;
}
