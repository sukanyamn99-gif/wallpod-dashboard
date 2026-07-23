import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getUserAccounts } from "@/lib/data/users";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/dashboard/sales");

  const accounts = await getUserAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ผู้ใช้งาน</h1>
        <p className="text-sm text-muted-foreground">
          ดูรายชื่อผู้ใช้งานทั้งหมดและกำหนดสิทธิ์การใช้งาน — การสร้างบัญชีและรีเซ็ตรหัสผ่านยังคงทำผ่าน Supabase Studio
        </p>
      </div>

      <UsersTable accounts={accounts} currentUserId={profile.id} />
    </div>
  );
}
