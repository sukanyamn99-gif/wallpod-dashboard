import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBillingDocumentById } from "@/lib/data/billing-documents";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintBillingDocumentView } from "../../../print-billing-document-view";

// Sets the real <title> server-side, via Next's own metadata system —
// setting document.title imperatively in the client view doesn't stick,
// since Next's router re-asserts the metadata-resolved title on its own
// after hydration. This is also what the ดาวน์โหลด PDF button (see
// download-pdf-button.tsx) reads to name the downloaded file.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const document = await getBillingDocumentById(id);
  return { title: document?.docNo ?? "ใบกำกับภาษี" };
}

// Mirrors billing-document-table.tsx's canDelete rule — owner/manager can
// edit any document — a plain "account" (ธุรการบัญชี) role gets the same blanket rights, anyone else only their own.
function canEdit(role: string, createdById: string | null, profileId: string) {
  if (role === "owner" || role === "manager" || role === "account") return true;
  return createdById === profileId;
}

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

  const allowEdit = canEdit(profile.role, document.createdById, profile.id);

  return (
    <PrintBillingDocumentView
      document={document}
      editHref={allowEdit ? `/dashboard/billing-documents/tax-invoice/edit/${id}` : undefined}
      closeHref="/dashboard/billing-documents/tax-invoice"
    />
  );
}
