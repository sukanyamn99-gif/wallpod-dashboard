import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmployees, getPayrollEntries } from "@/lib/data/payroll";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { EmployeesTable } from "./employees-table";
import { EntriesTable } from "./entries-table";

export default async function PayrollPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/payroll")) redirect("/dashboard/sales");

  const [employees, entries] = await Promise.all([getEmployees(), getPayrollEntries()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">เงินเดือน</h1>
        <p className="text-sm text-muted-foreground">บันทึกและคำนวณเงินเดือน/ค่าแรงพนักงานรายเดือน</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>พนักงาน</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeesTable employees={employees} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการจ่ายเงินเดือน</CardTitle>
        </CardHeader>
        <CardContent>
          <EntriesTable entries={entries} employees={employees} />
        </CardContent>
      </Card>
    </div>
  );
}
