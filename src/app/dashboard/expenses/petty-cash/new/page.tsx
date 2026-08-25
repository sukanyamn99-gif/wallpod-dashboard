import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getRecentPettyCashDescriptions, getRecentPettyCashBillers } from "@/lib/data/petty-cash";
import { canAccessPage } from "@/lib/permissions";
import { PettyCashForm } from "../petty-cash-form";

export default async function NewPettyCashPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");
  if (!["owner", "manager", "account"].includes(profile.role)) redirect("/dashboard/expenses/petty-cash");

  const [recentDescriptions, recentBillers] = await Promise.all([
    getRecentPettyCashDescriptions(),
    getRecentPettyCashBillers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกรายการเงินสดย่อย</h1>
      </div>

      <PettyCashForm recentDescriptions={recentDescriptions} recentBillers={recentBillers} />
    </div>
  );
}
