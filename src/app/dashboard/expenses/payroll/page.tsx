import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function PayrollPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payroll")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="เงินเดือน"
      description="บันทึกและคำนวณเงินเดือนพนักงาน — ยังไม่ได้ระบุรายละเอียด แจ้งได้ว่าต้องการฟิลด์อะไรบ้าง เช่น เงินเดือนพื้นฐาน, เบี้ยขยัน, ประกันสังคม, ภาษีหัก ณ ที่จ่าย"
    />
  );
}
