import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getUserAccounts } from "@/lib/data/users";
import { AddUserDialog } from "./add-user-dialog";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/dashboard/sales");

  const accounts = await getUserAccounts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ผู้ใช้งาน</h1>
          <p className="text-sm text-muted-foreground">
            ดูรายชื่อผู้ใช้งานทั้งหมด เพิ่มผู้ใช้งาน และกำหนดสิทธิ์การใช้งาน — การรีเซ็ตรหัสผ่านยังคงทำผ่าน Supabase Studio
          </p>
        </div>
        <AddUserDialog />
      </div>

      <UsersTable accounts={accounts} currentUserId={profile.id} />
    </div>
  );
}
