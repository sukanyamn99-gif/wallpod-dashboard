import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function GpDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/gp")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="GP Dashboard"
      description="กำไรขั้นต้นต่องาน แยกตามกลุ่มลูกค้า/สินค้า/เซลล์ — จะเปิดใช้งานหลัง MVP Sales Dashboard"
    />
  );
}
