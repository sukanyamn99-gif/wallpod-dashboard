import { redirect } from "next/navigation";
import { getBillingDocuments } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentTable } from "../billing-document-table";

export default async function InvoiceListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/invoice")) redirect("/dashboard/sales");

  const documents = await getBillingDocuments("invoice");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบแจ้งหนี้</h1>
        <p className="text-sm text-muted-foreground">ออกใบแจ้งหนี้จากรายการที่ยังไม่ได้ชำระของ WALLPOD Project Sales</p>
      </div>
      <BillingDocumentTable docType="invoice" documents={documents} currentProfile={profile} />
    </div>
  );
}
