import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommissionEntries, getCommissionRateTiers } from "@/lib/data/commission";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { RateTiersTable } from "./rate-tiers-table";
import { EntriesTable } from "./entries-table";

export default async function CommissionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const [tiers, entries] = await Promise.all([getCommissionRateTiers(), getCommissionEntries()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">คำนวณค่าคอมมิชชั่น</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกยอดขายที่มีค่าคอมมิชชั่น — คำนวณอัตราค่าคอมมิชชั่นจากอัตราส่วนลดที่ให้ลูกค้าอัตโนมัติ
        </p>
      </div>

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
          <CardTitle>รายการค่าคอมมิชชั่น</CardTitle>
        </CardHeader>
        <CardContent>
          <EntriesTable entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
