import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function ArDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/ar")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="AR Dashboard"
      description="ลูกหนี้ค้างชำระ แยกตามอายุหนี้และสถานะการชำระ — จะเปิดใช้งานหลัง MVP Sales Dashboard"
    />
  );
}
