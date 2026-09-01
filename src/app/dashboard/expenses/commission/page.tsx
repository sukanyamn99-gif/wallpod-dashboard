import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommissionableProjects, getCommissionRateTiers } from "@/lib/data/commission";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { RateTiersTable } from "./rate-tiers-table";
import { CommissionableTable } from "./commissionable-table";
import { ReportSelector } from "./report-selector";

export default async function CommissionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const [tiers, projects] = await Promise.all([getCommissionRateTiers(), getCommissionableProjects()]);
  const salesRepNames = Array.from(new Set(projects.map((p) => p.salesRepName))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">คำนวณค่าคอมมิชชั่น</h1>
        <p className="text-sm text-muted-foreground">
          ดึงงานที่เก็บเงินเรียบร้อยแล้วจาก Koonway Project Sales มาให้อัตโนมัติ แยกตามเดือน/พนักงานขาย — ใส่แค่ส่วนลดต่องาน
          ระบบจะคำนวณอัตราและค่าคอมมิชชั่นให้
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>พิมพ์รายงานค่าคอมมิชชั่น</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportSelector salesRepNames={salesRepNames} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>อัตราค่าคอมมิชชั่นตามส่วนลด</CardTitle>
        </CardHeader>
        <CardContent>
          <RateTiersTable tiers={tiers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>งานที่เก็บเงินเรียบร้อยแล้ว</CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionableTable projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
