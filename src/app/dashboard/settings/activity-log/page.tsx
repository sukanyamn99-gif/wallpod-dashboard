import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getLoginLog } from "@/lib/data/login-log";
import { ActivityLogTable } from "./activity-log-table";

export default async function ActivityLogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/dashboard/sales");

  const entries = await getLoginLog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">เก็บ log การใช้งาน</h1>
        <p className="text-sm text-muted-foreground">ประวัติการเข้าสู่ระบบของผู้ใช้งานทั้งหมด</p>
      </div>

      <ActivityLogTable entries={entries} />
    </div>
  );
}
