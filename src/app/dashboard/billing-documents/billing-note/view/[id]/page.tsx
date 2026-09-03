import { redirect } from "next/navigation";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintBillingDocumentView } from "../../../print-billing-document-view";

// Mirrors billing-document-table.tsx's canDelete rule — owner/manager can
// edit any document, anyone else only their own.
function canEdit(role: string, createdById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return createdById === profileId;
}

export default async function ViewBillingNotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/billing-documents/billing-note")) redirect("/dashboard/sales");

  const { id } = await params;
  const document = await getBillingDocumentById(id);

  if (!document || document.docType !== "billing_note") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">ไม่พบใบวางบิลนี้</h1>
      </div>
    );
  }

  const allowEdit = canEdit(profile.role, document.createdById, profile.id);

  return (
    <PrintBillingDocumentView
      document={document}
      editHref={allowEdit ? `/dashboard/billing-documents/billing-note/edit/${id}` : undefined}
    />
  );
}
