import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getEmployees, getPayrollEntryById } from "@/lib/data/payroll";
import { PayrollEntryForm } from "../../payroll-entry-form";

export default async function EditPayrollEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payroll")) redirect("/dashboard/sales");

  const [entry, employees] = await Promise.all([getPayrollEntryById(id), getEmployees()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขรายการเงินเดือน</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/expenses/payroll" className="underline underline-offset-2">
            ← กลับไปหน้าเงินเดือน
          </Link>
        </p>
      </div>

      {entry ? (
        <PayrollEntryForm employees={employees} mode="edit" entryId={entry.id} initialData={entry} />
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบรายการนี้ในระบบ</p>
      )}
    </div>
  );
}
