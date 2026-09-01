import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getEmployees } from "@/lib/data/payroll";
import { PayrollEntryForm } from "../payroll-entry-form";

export default async function NewPayrollEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payroll")) redirect("/dashboard/sales");

  const employees = await getEmployees();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกเงินเดือน</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/expenses/payroll" className="underline underline-offset-2">
            ← กลับไปหน้าเงินเดือน
          </Link>
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">กรุณาเพิ่มพนักงานก่อนบันทึกเงินเดือน</p>
      ) : (
        <PayrollEntryForm employees={employees} mode="create" />
      )}
    </div>
  );
}
