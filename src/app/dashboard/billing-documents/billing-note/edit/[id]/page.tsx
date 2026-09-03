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

export default async function EditBillingNotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/billing-note")) redirect("/dashboard/sales");

  const { id } = await params;
  const document = await getBillingDocumentById(id);
  const allowed = document ? canEdit(profile.role, document.createdById, profile.id) : false;

  if (!document || document.docType !== "billing_note" || !allowed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ไม่พบข้อมูล</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/billing-documents/billing-note" className="underline underline-offset-2">
              ← กลับไปหน้าใบวางบิล
            </Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">ไม่พบใบวางบิลนี้ในระบบ หรือคุณไม่มีสิทธิ์แก้ไข</p>
      </div>
    );
  }

  const [customers, salesReps] = await Promise.all([getCustomers(), getSalesReps()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบวางบิล {document.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/dashboard/billing-documents/billing-note/view/${id}`} className="underline underline-offset-2">
            ← กลับไปหน้าใบวางบิล
          </Link>
        </p>
      </div>
      <BillingDocumentForm
        docType="billing_note"
        customers={customers}
        salesReps={salesReps}
        listPath="/dashboard/billing-documents/billing-note"
        mode="edit"
        docId={id}
        initialData={document}
      />
    </div>
  );
}
