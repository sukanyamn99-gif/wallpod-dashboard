import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PettyCashForm } from "../petty-cash-form";

export default async function NewPettyCashPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");
  if (!["owner", "manager", "account"].includes(profile.role)) redirect("/dashboard/expenses/petty-cash");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกรายการเงินสดย่อย</h1>
      </div>

      <PettyCashForm />
    </div>
  );
}
