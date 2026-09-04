import { redirect } from "next/navigation";
import Link from "next/link";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getCustomers, getSalesReps } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BillingDocumentForm } from "../../../billing-document-form";

// Mirrors billing-document-table.tsx's canDelete rule — owner/manager can
// edit any document, anyone else only their own.
function canEdit(role: string, createdById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return createdById === profileId;
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/invoice")) redirect("/dashboard/sales");

  const { id } = await params;
  const document = await getBillingDocumentById(id);
  const allowed = document ? canEdit(profile.role, document.createdById, profile.id) : false;

  if (!document || document.docType !== "invoice" || !allowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/billing-documents/invoice" className="underline underline-offset-2">
              ← กลับไปหน้าใบแจ้งหนี้
            </Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">ไม่พบใบแจ้งหนี้นี้ในระบบ หรือคุณไม่มีสิทธิ์แก้ไข</p>
      </div>
    );
  }

  const [customers, salesReps] = await Promise.all([getCustomers(), getSalesReps()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบแจ้งหนี้ {document.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/billing-documents/invoice/view/${id}`} className="underline underline-offset-2">
            ← กลับไปหน้าใบแจ้งหนี้
          </Link>
        </p>
      </div>
      <BillingDocumentForm
        docType="invoice"
        customers={customers}
        salesReps={salesReps}
        listPath="/dashboard/billing-documents/invoice"
        mode="edit"
        docId={id}
        initialData={document}
      />
    </div>
  );
}
