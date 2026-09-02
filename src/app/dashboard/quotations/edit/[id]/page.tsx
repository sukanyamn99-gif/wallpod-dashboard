import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getSalesReps, getCustomers } from "@/lib/data/reference";
import { getDistinctQuotationItemFields, getQuotationById, getSignedQuotationImageUrls } from "@/lib/data/quotations";
import { QuotationForm } from "../../quotation-form";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const { id } = await params;
  const [salesReps, customers, quotation, itemFieldSuggestions] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getQuotationById(id),
    getDistinctQuotationItemFields(),
  ]);

  if (!quotation) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">แก้ไขใบเสนอราคา</h1>
        <p className="text-muted-foreground">ไม่พบใบเสนอราคานี้ในระบบ</p>
      </div>
    );
  }

  const imagePaths = quotation.items.map((it) => it.imagePath).filter((p): p is string => !!p);
  const imageUrlsByItemId = await getSignedQuotationImageUrls(imagePaths);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขใบเสนอราคา {quotation.docNo}</h1>
        <p className="text-sm text-muted-foreground">ลูกค้า: {quotation.customerName}</p>
      </div>
      <QuotationForm
        salesReps={salesReps}
        customers={customers}
        mode="edit"
        quotationId={id}
        initialData={quotation}
        imageUrlsByItemId={imageUrlsByItemId}
        itemFieldSuggestions={itemFieldSuggestions}
      />
    </div>
  );
}
