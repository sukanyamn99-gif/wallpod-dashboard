import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getSalesReps, getCustomers } from "@/lib/data/reference";
import { getDistinctQuotationItemFields } from "@/lib/data/quotations";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const [salesReps, customers, itemFieldSuggestions] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getDistinctQuotationItemFields(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สร้างใบเสนอราคา</h1>
        <p className="text-sm text-muted-foreground">กรอกข้อมูลลูกค้าและรายการสินค้าเพื่อสร้างใบเสนอราคาใหม่</p>
      </div>
      <QuotationForm salesReps={salesReps} customers={customers} mode="create" itemFieldSuggestions={itemFieldSuggestions} />
    </div>
  );
}
