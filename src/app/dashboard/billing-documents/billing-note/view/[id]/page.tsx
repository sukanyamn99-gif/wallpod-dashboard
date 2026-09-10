import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintBillingDocumentView } from "../../../print-billing-document-view";

// See tax-invoice/view/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const document = await getBillingDocumentById(id);
  return { title: document?.docNo ?? "ใบวางบิล" };
}

// Mirrors billing-document-table.tsx's canDelete rule — owner/manager can
// edit any document — a plain "account" (ธุรการบัญชี) role gets the same blanket rights, anyone else only their own.
function canEdit(role: string, createdById: string | null, profileId: string) {
  if (role === "owner" || role === "manager" || role === "account") return true;
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
      closeHref="/dashboard/billing-documents/billing-note"
    />
  );
}
