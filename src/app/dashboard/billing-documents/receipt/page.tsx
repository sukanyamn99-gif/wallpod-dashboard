import { redirect } from "next/navigation";
import { getBillingDocuments } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentTable } from "../billing-document-table";

export default async function ReceiptListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/receipt")) redirect("/dashboard/sales");

  const documents = await getBillingDocuments("receipt");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบเสร็จรับเงิน</h1>
        <p className="text-sm text-muted-foreground">
          ออกใบเสร็จรับเงินจากใบแจ้งหนี้ของ WALLPOD Project Sales — บันทึกว่าได้รับชำระแล้ว
        </p>
      </div>
      <BillingDocumentTable docType="receipt" documents={documents} currentProfile={profile} />
    </div>
  );
}
