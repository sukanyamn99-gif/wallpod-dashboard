import { redirect } from "next/navigation";
import { getBillingDocuments } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentTable } from "../billing-document-table";

export default async function BillingNoteListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/billing-note")) redirect("/dashboard/sales");

  const documents = await getBillingDocuments("billing_note");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบวางบิล</h1>
        <p className="text-sm text-muted-foreground">ออกใบวางบิลจากใบแจ้งหนี้ของ WALLPOD Project Sales ที่ยังไม่ได้ชำระ</p>
      </div>
      <BillingDocumentTable docType="billing_note" documents={documents} currentProfile={profile} />
    </div>
  );
}
