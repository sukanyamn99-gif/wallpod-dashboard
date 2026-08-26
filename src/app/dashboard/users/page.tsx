import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getUserAccounts } from "@/lib/data/users";
import { canAccessPage } from "@/lib/permissions";
import { AddUserDialog } from "./add-user-dialog";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/users")) redirect("/dashboard/sales");

  const accounts = await getUserAccounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ผู้ใช้งาน</h1>
          <p className="text-sm text-muted-foreground">
            ดูรายชื่อผู้ใช้งานทั้งหมด แก้ไขข้อมูล กำหนดสิทธิ์ รีเซ็ตรหัสผ่าน และลบผู้ใช้งานได้
          </p>
        </div>
        {profile.role === "owner" && <AddUserDialog />}
      </div>

      <UsersTable
        accounts={accounts}
        currentUserId={profile.id}
        canManageAccounts={profile.role === "owner" || profile.role === "manager"}
      />
    </div>
  );
}
