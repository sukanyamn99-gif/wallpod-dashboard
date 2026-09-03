import { redirect } from "next/navigation";
import { getBillingDocuments } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentTable } from "../billing-document-table";

export default async function TaxInvoiceListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/tax-invoice")) redirect("/dashboard/sales");

  const documents = await getBillingDocuments("tax_invoice");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบกำกับภาษี</h1>
        <p className="text-sm text-muted-foreground">ออกใบกำกับภาษีจากใบแจ้งหนี้ของ WALLPOD Project Sales ที่ยังไม่ได้ชำระ</p>
      </div>
      <BillingDocumentTable docType="tax_invoice" documents={documents} currentProfile={profile} />
    </div>
  );
}
