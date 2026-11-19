import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getSalesReps, getCustomers } from "@/lib/data/reference";
import { getDistinctQuotationItemFields, getQuotationById, getSignedQuotationImageUrls } from "@/lib/data/quotations";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ copyFrom?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const { copyFrom } = await searchParams;
  const [salesReps, customers, itemFieldSuggestions, source] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getDistinctQuotationItemFields(),
    copyFrom ? getQuotationById(copyFrom) : Promise.resolve(null),
  ]);

  // Copying starts a fresh document from the old one's content: today's date,
  // and nothing that belongs to the old job (JOB no., PO no., delivery date,
  // product codes given at production). The number and status come out new
  // when it is saved.
  const copied = source
    ? {
        ...source,
        quoteDate: new Date().toISOString().slice(0, 10),
        jobNumber: null,
        poNumber: null,
        deliveryDate: null,
        items: source.items.map((it) => ({ ...it, productCode: null })),
      }
    : undefined;
  const imageUrlsByItemId = source
    ? await getSignedQuotationImageUrls(source.items.map((it) => it.imagePath).filter((p): p is string => !!p))
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สร้างใบเสนอราคา</h1>
        <p className="text-sm text-muted-foreground">
          {source
            ? `คัดลอกจากใบเสนอราคา ${source.docNo} — ตรวจและแก้ไขข้อมูลก่อนบันทึก จะได้เลขที่ใบใหม่`
            : "กรอกข้อมูลลูกค้าและรายการสินค้าเพื่อสร้างใบเสนอราคาใหม่"}
        </p>
      </div>
      <QuotationForm
        salesReps={salesReps}
        customers={customers}
        mode="create"
        initialData={copied}
        imageUrlsByItemId={imageUrlsByItemId}
        itemFieldSuggestions={itemFieldSuggestions}
      />
    </div>
  );
}
