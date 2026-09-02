import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomers, getProductCategories, getSalesReps } from "@/lib/data/reference";
import { getQuotationById } from "@/lib/data/quotations";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeProjectCosts } from "@/lib/permissions";
import { ProjectSaleForm, type ProjectSaleInitialData } from "../project-sale-form";

export default async function NewProjectSalePage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuotation?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/project-sales")) redirect("/dashboard/sales");

  const { fromQuotation } = await searchParams;

  const [salesReps, customers, categories, quotation] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getProductCategories(),
    fromQuotation ? getQuotationById(fromQuotation) : Promise.resolve(null),
  ]);

  // Only customer/project/sales-rep/date and the pre-VAT total carry over —
  // quotation line items are free-text descriptions, not tied to the
  // product_category taxonomy project_items requires, so guessing a
  // category per line would risk silently misclassifying revenue. One
  // blank-category row prefilled with the quote's total amount is an
  // honest middle ground: the money matches exactly, categorizing it is
  // still a deliberate one-pick step for whoever converts the quote.
  const initialData: ProjectSaleInitialData | undefined = quotation
    ? {
        projectDate: quotation.quoteDate,
        jobNo: null,
        customerName: quotation.customerName,
        projectName: quotation.projectName,
        salesRepId: quotation.salesRepId ?? "",
        customerType: "",
        productionStatus: "",
        items: [{ category: "", amount: String(quotation.preVat) }],
        costs: {
          material_cost: "",
          glue_cost: "",
          cutting_cost: "",
          install_cost: "",
          parking_cost: "",
          shipping_cost: "",
        },
        status: "",
        invoiceNo1: "",
        amount1: "",
        paidDate1: "",
        receiptNo1: "",
        receivedDate1: "",
        invoiceNo2: "",
        amount2: "",
        paidDate2: "",
        receiptNo2: "",
        receivedDate2: "",
        invoiceNo3: "",
        amount3: "",
        paidDate3: "",
        receiptNo3: "",
        receivedDate3: "",
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกงานขายใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/project-sales" className="underline underline-offset-2">
            ← กลับไปหน้า WALLPOD Project Sales
          </Link>
        </p>
        {quotation && (
          <p className="mt-1 text-sm text-muted-foreground">
            ดึงข้อมูลจากใบเสนอราคา {quotation.docNo} มาให้แล้ว — กรุณาเลือกหมวดหมู่สินค้าและตรวจสอบข้อมูลก่อนบันทึก
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลงานขาย</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectSaleForm
            salesReps={salesReps}
            customers={customers}
            categories={categories.map((c) => c.name)}
            canSeeCosts={canSeeProjectCosts(profile.role)}
            initialData={initialData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
