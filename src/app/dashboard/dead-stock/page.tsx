import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

export default async function DeadStockDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/dead-stock")) redirect("/dashboard/sales");

  return (
    <ComingSoon
      title="Dead Stock Dashboard"
      description="สินค้าที่ค้างสต๊อกนานไม่เคลื่อนไหว — จะเปิดใช้งานหลัง MVP Sales Dashboard"
    />
  );
}
