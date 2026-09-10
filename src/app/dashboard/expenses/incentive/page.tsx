import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { MonthSelector } from "./month-selector";

export default async function IncentivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/incentive")) redirect("/dashboard/sales");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">คำนวณ Incentive</h1>
        <p className="text-sm text-muted-foreground">
          ดึงงานขายจาก Koonway Project Sales ตามเดือนที่เลือก คำนวณกำไรขั้นต้น Koonway 70% / ค่าคอมบริษัท 15% / ค่า
          Incentive 5% ของกำไรแต่ละงาน แล้วแบ่งยอดรวมค่า Incentive เท่ากันให้ทีม Support
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>พิมพ์รายงานค่า Incentive</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthSelector />
        </CardContent>
      </Card>
    </div>
  );
}
