import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function CommissionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="คำนวณค่าคอมมิชชั่น"
      description="คำนวณค่าคอมมิชชั่นของเซลล์แต่ละคน — ยังไม่ได้ระบุรายละเอียด แจ้งได้ว่าคำนวณจากอะไร เช่น % จากยอดขาย หรือ % จากกำไร, อัตราต่างกันตามประเภทลูกค้าหรือไม่"
    />
  );
}
