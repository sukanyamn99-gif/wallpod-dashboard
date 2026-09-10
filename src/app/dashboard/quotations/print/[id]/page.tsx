import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getQuotationById, getSignedQuotationImageUrls } from "@/lib/data/quotations";
import { getQuotationPrintTemplates } from "@/lib/data/quotation-print-settings";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintQuotationView } from "../print-quotation-view";

// Sets the real <title> server-side, via Next's own metadata system —
// setting document.title imperatively in the client view doesn't stick,
// since Next's router re-asserts the metadata-resolved title on its own
// after hydration. This is also what the ดาวน์โหลด PDF button reads to
// name the downloaded file.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const quotation = await getQuotationById(id);
  return { title: quotation?.docNo ?? "ใบเสนอราคา" };
}

export default async function PrintQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const { id } = await params;
  const { from } = await searchParams;
  const quotation = await getQuotationById(id);
  if (!quotation) redirect("/dashboard/quotations");

  const [imageUrlsByPath, printTemplates] = await Promise.all([
    getSignedQuotationImageUrls(quotation.items.map((it) => it.imagePath).filter((p): p is string => !!p)),
    getQuotationPrintTemplates(),
  ]);

  return (
    <PrintQuotationView
      quotation={quotation}
      imageUrlsByPath={imageUrlsByPath}
      template={printTemplates[quotation.quotationType]}
      fromProduction={from === "production-orders"}
    />
  );
}
