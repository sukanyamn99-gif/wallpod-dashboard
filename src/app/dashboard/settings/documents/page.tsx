import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getQuotationPrintTemplates } from "@/lib/data/quotation-print-settings";
import { QuotationPrintSettingsForm } from "./quotation-print-settings-form";

export default async function DocumentSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/settings/documents")) redirect("/dashboard/sales");

  const templates = await getQuotationPrintTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ตั้งค่าเอกสารต่างๆ</h1>
        <p className="text-sm text-muted-foreground">
          แก้ไขข้อความมาตรฐาน (Remark) และเงื่อนไขการเตรียมพื้นที่ก่อนติดตั้ง ที่พิมพ์บนใบเสนอราคา แยกตามประเภทค่าของ/ค่าติดตั้ง
        </p>
      </div>
      <QuotationPrintSettingsForm templates={templates} />
    </div>
  );
}
