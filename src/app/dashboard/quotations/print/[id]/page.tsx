import { redirect } from "next/navigation";
import { getQuotationById, getSignedQuotationImageUrls } from "@/lib/data/quotations";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintQuotationView } from "../print-quotation-view";

export default async function PrintQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const { id } = await params;
  const quotation = await getQuotationById(id);
  if (!quotation) redirect("/dashboard/quotations");

  const imagePaths = quotation.items.map((it) => it.imagePath).filter((p): p is string => !!p);
  const imageUrlsByPath = await getSignedQuotationImageUrls(imagePaths);

  return <PrintQuotationView quotation={quotation} imageUrlsByPath={imageUrlsByPath} />;
}
