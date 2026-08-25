import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getLoginLog } from "@/lib/data/login-log";
import { getActivityLog } from "@/lib/data/activity-log";
import { ActivityLogTable } from "./activity-log-table";

export default async function ActivityLogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/dashboard/sales");

  const [logins, actions] = await Promise.all([getLoginLog(), getActivityLog()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">เก็บ log การใช้งาน</h1>
        <p className="text-sm text-muted-foreground">
          ประวัติการเข้าสู่ระบบและการกระทำสำคัญ (ลบ/แก้ไขสิทธิ์/สร้างบัญชี) ของผู้ใช้งานทั้งหมด
        </p>
      </div>

      <ActivityLogTable logins={logins} actions={actions} />
    </div>
  );
}
