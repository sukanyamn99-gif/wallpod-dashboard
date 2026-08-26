import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function DocumentSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/settings/documents")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="ตั้งค่าเอกสารต่างๆ"
      description="ตั้งค่ารูปแบบ/เลขที่เอกสารต่างๆ ของระบบ — ยังไม่ได้ระบุรายละเอียด แจ้งได้ว่าต้องการตั้งค่าอะไรบ้าง เช่น รูปแบบเลขที่เอกสาร, ข้อมูลบริษัทสำหรับพิมพ์เอกสาร"
    />
  );
}
